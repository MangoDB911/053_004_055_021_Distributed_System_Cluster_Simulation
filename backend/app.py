from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Data store
nodes = {}

# Validate CPU cores
def validate_cpu_cores(cpu_cores):
    if not isinstance(cpu_cores, int) or cpu_cores <= 0:
        return False
    return True

def format_timestamp():
    """Returns current time in 'DD Month Year: hr:min:sec' format"""
    return datetime.now().strftime("%d %B %Y: %H:%M:%S")

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
    
    return jsonify({
        "node_id": node_id,
        "message": f"Node {node_id} added successfully",
        "available_cpu": data['cpu_cores'],
        "timestamp": current_time
    }), 201

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)