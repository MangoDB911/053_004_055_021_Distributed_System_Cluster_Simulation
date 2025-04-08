from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime
import time
import threading
import atexit
import os
import docker

app = Flask(__name__)
CORS(app)

# Initialize Docker client
docker_client = docker.from_env()

# DATA STORES
nodes = {}
pods = {}
heartbeat_threads = {}

# ==========HELPER FUNCTIONS==========
def validate_cpu_cores(cpu_cores):
    return isinstance(cpu_cores, int) and cpu_cores > 0

def format_timestamp():
    return datetime.now().strftime("%d %B %Y: %H:%M:%S")

def send_heartbeats(node_id):
    while True:
        time.sleep(5)
        try:
            node = nodes.get(node_id)
            if not node or node.get("status") != "healthy":
                break
                
            container = docker_client.containers.get(node["container_id"])
            if container.status != "running":
                nodes[node_id]["status"] = "stopped"
                break
                
            nodes[node_id]["last_heartbeat"] = format_timestamp()
        except Exception as e:
            print(f"Heartbeat error: {str(e)}")
            nodes[node_id]["status"] = "error"
            break

def schedule_pod(cpu_required):
    best_node = None
    min_diff = float('inf')
    
    for node_id, node in nodes.items():
        if node["status"] == "healthy" and node["available_cpu"] >= cpu_required:
            diff = node["available_cpu"] - cpu_required
            if diff < min_diff:
                min_diff = diff
                best_node = node_id
    
    return best_node

# Add these new endpoints
@app.route('/nodes/<node_id>/resume', methods=['POST'])
def resume_node(node_id):
    if node_id not in nodes:
        return jsonify({"error": "Node not found"}), 404
        
    try:
        container = docker_client.containers.get(nodes[node_id]["container_id"])
        container.start()
        nodes[node_id]["status"] = "healthy"
        
        # Resume any pending pods
        for pod_id, pod in pods.items():
            if pod.get("status") == "pending_reschedule":
                new_node_id = schedule_pod(pod["cpu_required"])
                if new_node_id:
                    pods[pod_id]["status"] = "running"
                    pods[pod_id]["node_id"] = new_node_id
                    nodes[new_node_id]["pods"].append(pod_id)
                    nodes[new_node_id]["available_cpu"] -= pod["cpu_required"]
        
        return jsonify({
            "message": f"Node {node_id} resumed",
            "timestamp": format_timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def reschedule_pods(node_id):
    for pod_id in nodes[node_id]["pods"]:
        pod = pods[pod_id]
        new_node_id = schedule_pod(pod["cpu_required"])
        if new_node_id:
            nodes[new_node_id]["pods"].append(pod_id)
            pods[pod_id]["node_id"] = new_node_id
            nodes[new_node_id]["available_cpu"] -= pod["cpu_required"]
        else:
            pods[pod_id]["status"] = "pending_reschedule"
    nodes[node_id]["pods"] = []

# ==========NODE MANAGEMENT==========
@app.route('/nodes', methods=['GET'])
def list_nodes():
    return jsonify({
        "nodes": nodes,
        "total_nodes": len(nodes),
        "last_updated": format_timestamp()
    })

@app.route('/nodes', methods=['POST'])
def add_node():
    data = request.get_json()
    
    if not data or 'cpu_cores' not in data:
        return jsonify({"error": "Missing CPU cores"}), 400
    
    if not validate_cpu_cores(data['cpu_cores']):
        return jsonify({"error": "Invalid CPU value"}), 400
    
    try:
        container = docker_client.containers.run(
            "python:3.9-slim",
            detach=True,
            name=f"cluster-node-{len(nodes)+1}",
            command=["tail", "-f", "/dev/null"],
            cpu_shares=int(data['cpu_cores'] * 1024)
        )

        node_id = f"node-{len(nodes) + 1}"
        current_time = format_timestamp()
        nodes[node_id] = {
            "cpu_cores": data['cpu_cores'],
            "available_cpu": data['cpu_cores'],
            "status": "healthy",
            "pods": [],
            "container_id": container.id,
            "created_at": current_time,
            "last_heartbeat": current_time
        }
        
        heartbeat_thread = threading.Thread(
            target=send_heartbeats,
            args=(node_id,),
            daemon=True
        )
        heartbeat_thread.start()
        heartbeat_threads[node_id] = heartbeat_thread
        
        return jsonify({
            "node_id": node_id,
            "container_id": container.id,
            "message": "Node added with container",
            "timestamp": current_time
        }), 201
        
    except Exception as e:
        return jsonify({"error": f"Container error: {str(e)}"}), 500

@app.route('/nodes/<node_id>/stop', methods=['POST'])
def stop_node(node_id):
    if node_id not in nodes:
        return jsonify({"error": "Node not found"}), 404
        
    try:
        container = docker_client.containers.get(nodes[node_id]["container_id"])
        container.stop()
        nodes[node_id]["status"] = "stopped"
        reschedule_pods(node_id)
        return jsonify({
            "message": f"Node {node_id} stopped",
            "timestamp": format_timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========POD MANAGEMENT==========
@app.route('/pods', methods=['GET'])
def list_pods():
    return jsonify({
        "pods": pods,
        "total_pods": len(pods),
        "last_updated": format_timestamp()
    })

@app.route('/pods', methods=['POST'])
def launch_pod():
    data = request.get_json()
    
    # Ensure JSON content type
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400
        
    if not data or 'cpu_required' not in data:
        return jsonify({"error": "Missing CPU requirement"}), 400

    try:
        cpu_required = int(data['cpu_required'])
        if cpu_required <= 0:
            return jsonify({"error": "CPU must be positive"}), 400
            
        node_id = schedule_pod(cpu_required)
        if not node_id:
            return jsonify({"error": "No available nodes with sufficient resources"}), 400

        pod_id = f"pod-{len(pods) + 1}"
        nodes[node_id]["available_cpu"] -= cpu_required
        nodes[node_id]["pods"].append(pod_id)
        pods[pod_id] = {
            "node_id": node_id,
            "cpu_required": cpu_required,
            "status": "running",
            "created_at": format_timestamp()
        }

        return jsonify({
            "pod_id": pod_id,
            "node_id": node_id,
            "message": "Pod launched successfully",
            "timestamp": format_timestamp()
        }), 201
        
    except ValueError:
        return jsonify({"error": "Invalid CPU value (must be integer)"}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ==========WEB INTERFACE==========
@app.route('/')
def web_interface():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cluster Dashboard</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    </head>
    <body class="bg-gray-100">
        <div id="app" class="container mx-auto px-4 py-8"></div>
        <script src="https://unpkg.com/react@17/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script type="text/babel" src="/static/app.js"></script>
    </body>
    </html>
    """

@app.route('/static/<path:filename>')
def serve_static(filename):
    if not os.path.exists('static'):
        os.makedirs('static')
    return send_from_directory('static', filename)

def cleanup():
    print("Cleaning up containers...")
    for node in nodes.values():
        try:
            container = docker_client.containers.get(node["container_id"])
            container.stop()
            container.remove(force=True)
        except Exception as e:
            print(f"Cleanup error: {str(e)}")

def check_health():
    while True:
        time.sleep(10)
        for node_id, node in nodes.items():
            try:
                container = docker_client.containers.get(node["container_id"])
                if container.status != "running":
                    node["status"] = "stopped"
            except Exception as e:
                print(f"Health check error for {node_id}: {str(e)}")
                node["status"] = "error"

if __name__ == '__main__':
    atexit.register(cleanup)
    health_thread = threading.Thread(target=check_health)
    health_thread.daemon = True
    health_thread.start()
    app.run(host='0.0.0.0', port=5000, debug=True)