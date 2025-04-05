from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import time
import threading
import requests
import atexit

app = Flask(__name__)
CORS(app)


# GLOBAL DATA STORES
nodes = {}
pods = {}
heartbeat_threads = {}  # Stores heartbeat threads for each node
# Best-fit algorithm is used in this project

# HELPER FUNCTIONS
def validate_cpu_cores(cpu_cores):
    """Validate CPU core input"""
    return isinstance(cpu_cores, int) and cpu_cores > 0

def format_timestamp():
    """Returns current time in 'DD Month Year: hr:min:sec' format"""
    return datetime.now().strftime("%d %B %Y: %H:%M:%S")

def send_heartbeats(node_id):
    """Background thread to simulate automatic heartbeats for a node"""
    while True:
        time.sleep(5)  # Send heartbeat every 5 seconds
        try:
            if nodes.get(node_id, {}).get("status") != "healthy":
                break  # Stop if node is manually marked unhealthy
            
            # Update heartbeat directly
            nodes[node_id]["last_heartbeat"] = format_timestamp()
        except Exception as e:
            print(f"Heartbeat error for {node_id}: {str(e)}")
            break

# WEEK 1 IMPLEMENTATION
@app.route('/nodes', methods=['GET'])
def list_nodes():
    """List all nodes in the cluster"""
    return jsonify({
        "nodes": nodes,
        "total_nodes": len(nodes),
        "last_updated": format_timestamp()
    })

@app.route('/nodes', methods=['POST'])
def add_node():
    """Add a new node to the cluster"""
    data = request.get_json()
    
    # Input validation
    if not data or 'cpu_cores' not in data:
        return jsonify({"error": "Missing 'cpu_cores' in request"}), 400
    
    if not validate_cpu_cores(data['cpu_cores']):
        return jsonify({"error": "Invalid CPU cores (must be positive integer)"}), 400
    
    # Create node
    node_id = f"node-{len(nodes) + 1}"
    current_time = format_timestamp()
    nodes[node_id] = {
        "cpu_cores": data['cpu_cores'],
        "available_cpu": data['cpu_cores'],
        "status": "healthy",
        "pods": [],
        "created_at": current_time,
        "last_heartbeat": current_time
    }
    
    # Start automatic heartbeat thread for this node
    heartbeat_thread = threading.Thread(
        target=send_heartbeats,
        args=(node_id,),
        daemon=True
    )
    heartbeat_thread.start()
    heartbeat_threads[node_id] = heartbeat_thread
    
    return jsonify({
        "node_id": node_id,
        "message": f"Node {node_id} added successfully",
        "timestamp": current_time
    }), 201

# WEEK 2 IMPLEMENTATION
def schedule_pod(cpu_required):
    """Schedule pod using Best-Fit algorithm"""
    best_node = None
    min_diff = float('inf')  # Track smallest leftover CPU
    
    for node_id, node in nodes.items():
        if node["status"] == "healthy" and node["available_cpu"] >= cpu_required:
            diff = node["available_cpu"] - cpu_required
            if diff < min_diff:
                min_diff = diff
                best_node = node_id
    
    return best_node

@app.route('/pods', methods=['POST'])
def launch_pod():
    """Launch a new pod with CPU requirements"""
    data = request.get_json()
    if not data or 'cpu_required' not in data:
        return jsonify({"error": "Missing 'cpu_required' in request"}), 400

    cpu_required = data['cpu_required']
    if not validate_cpu_cores(cpu_required):
        return jsonify({"error": "Invalid CPU value (must be positive integer)"}), 400

    # Schedule pod
    node_id = schedule_pod(cpu_required)
    if not node_id:
        return jsonify({"error": "No nodes available with sufficient resources"}), 400

    # Update node and pod records
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
        "message": f"Pod scheduled on {node_id}",
        "timestamp": format_timestamp()
    }), 201

@app.route('/nodes/<node_id>/heartbeat', methods=['POST'])
def node_heartbeat(node_id):
    """Update node heartbeat timestamp"""
    if node_id not in nodes:
        return jsonify({"error": "Node not found"}), 404

    nodes[node_id]["last_heartbeat"] = format_timestamp()
    return jsonify({
        "node_id": node_id,
        "status": "heartbeat_acknowledged",
        "timestamp": format_timestamp()
    }), 200

def check_health():
    """Background thread to monitor node health"""
    while True:
        time.sleep(10)  # Check every 10 seconds
        current_time = datetime.now()
        for node_id, node in nodes.items():
            try:
                last_heartbeat = datetime.strptime(node["last_heartbeat"], "%d %B %Y: %H:%M:%S")
                if (current_time - last_heartbeat).total_seconds() > 15:  # 15s timeout
                    nodes[node_id]["status"] = "unhealthy"
                    # TODO: Add pod rescheduling logic here
            except:
                continue

# ERROR HANDLERS
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Endpoint not found",
        "timestamp": format_timestamp()
    }), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({
        "error": "Internal server error",
        "timestamp": format_timestamp()
    }), 500

def cleanup():
    """Clean up threads on exit"""
    for thread in heartbeat_threads.values():
        thread.join(timeout=1)

if __name__ == '__main__':
    # Register cleanup handler
    atexit.register(cleanup)
    
    # Start health monitor thread
    health_thread = threading.Thread(target=check_health)
    health_thread.daemon = True
    health_thread.start()
    
    # Start Flask server
    app.run(host='0.0.0.0', port=5000, debug=True)