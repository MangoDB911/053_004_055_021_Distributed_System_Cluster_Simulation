const ClusterDashboard = () => {
    const [nodes, setNodes] = React.useState({});
    const [pods, setPods] = React.useState({});
    const [cpuCores, setCpuCores] = React.useState(2);
    const [cpuRequired, setCpuRequired] = React.useState(1);
    const [notifications, setNotifications] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    const addNotification = (message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [nodesRes, podsRes] = await Promise.all([
                fetch('/nodes'),
                fetch('/pods')
            ]);

            if (!nodesRes.ok) throw new Error(await nodesRes.text());
            if (!podsRes.ok) throw new Error(await podsRes.text());

            setNodes((await nodesRes.json()).nodes || {});
            setPods((await podsRes.json()).pods || {});
        } catch (err) {
            addNotification('Failed to fetch cluster data', 'error');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const addNode = async () => {
        try {
            const response = await fetch('/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpu_cores: cpuCores })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            addNotification(`Node ${data.node_id} added with ${cpuCores} CPU cores`, 'success');
            fetchData();
        } catch (err) {
            addNotification(err.message, 'error');
        }
    };

    const stopNode = async (nodeId) => {
        try {
            const response = await fetch(`/nodes/${nodeId}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            addNotification(`Node ${nodeId} stopped. Pods rescheduled.`, 'warning');
            fetchData();
        } catch (err) {
            addNotification(err.message, 'error');
        }
    };

    const resumeNode = async (nodeId) => {
        try {
            const response = await fetch(`/nodes/${nodeId}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            addNotification(`Node ${nodeId} resumed`, 'success');
            fetchData();
        } catch (err) {
            addNotification(err.message, 'error');
        }
    };

    const launchPod = async () => {
        try {
            const response = await fetch('/pods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ cpu_required: cpuRequired })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to launch pod');
            }

            addNotification(`Pod ${data.pod_id} launched on ${data.node_id}`, 'success');
            fetchData();
        } catch (err) {
            addNotification(err.message, 'error');
            console.error('Pod launch error:', err);
        }
    };

    React.useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            {/* Notifications */}
            <div className="fixed top-4 right-4 space-y-2 z-50 w-80">
                {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 rounded-lg shadow-md flex justify-between items-center ${notif.type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' :
                        notif.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' :
                            'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
                        }`}>
                        <span>{notif.message}</span>
                        <button
                            onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Header */}
            <header className="bg-white shadow rounded-lg p-6">
                <h1 className="text-3xl font-bold text-gray-800">Cluster Management Dashboard</h1>
                <p className="text-gray-600 mt-2">Manage your distributed system nodes and pods</p>
            </header>

            {/* Node/Pod Management Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Node Management</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CPU Cores</label>
                            <input
                                type="number"
                                min="1"
                                value={cpuCores}
                                onChange={(e) => setCpuCores(parseInt(e.target.value) || 1)}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={addNode}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Node'}
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Pod Management</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CPU Required</label>
                            <input
                                type="number"
                                min="1"
                                value={cpuRequired}
                                onChange={(e) => setCpuRequired(parseInt(e.target.value) || 1)}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <button
                            onClick={launchPod}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50"
                        >
                            {loading ? 'Launching...' : 'Launch Pod'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Cluster Status */}
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Nodes ({Object.keys(nodes).length})</h2>
                    {loading && <span className="text-gray-500 text-sm">Updating...</span>}
                </div>

                {Object.keys(nodes).length === 0 ? (
                    <p className="text-gray-500">No nodes available. Add a node to get started.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(nodes).map(([id, node]) => (
                            <div key={id} className={`border rounded-lg p-4 transition-all duration-200 ${node.status === 'healthy' ? 'border-green-200 bg-green-50 hover:bg-green-100' :
                                node.status === 'stopped' ? 'border-gray-300 bg-gray-100 hover:bg-gray-200' :
                                    'border-red-200 bg-red-50 hover:bg-red-100'
                                }`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-gray-800">{id}</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Container: <span className="font-mono">{node.container_id?.substring(0, 8)}...</span>
                                        </p>
                                    </div>
                                    <div className="flex space-x-2">
                                        {node.status === 'healthy' ? (
                                            <button
                                                onClick={() => stopNode(id)}
                                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded-full hover:bg-yellow-100"
                                                title="Stop Node"
                                                disabled={loading}
                                            >
                                                <i className="fas fa-pause"></i>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => resumeNode(id)}
                                                className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100"
                                                title="Resume Node"
                                                disabled={loading}
                                            >
                                                <i className="fas fa-play"></i>
                                            </button>
                                        )}
                                        <span className={`px-2 py-1 text-xs rounded-full ${node.status === 'healthy' ? 'bg-green-100 text-green-800' :
                                            node.status === 'stopped' ? 'bg-gray-200 text-gray-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {node.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">CPU:</span>
                                        <span className="font-medium">
                                            {node.available_cpu}/{node.cpu_cores} cores
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Pods:</span>
                                        <span className="font-medium">
                                            {node.pods?.length || 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Last active:</span>
                                        <span className="font-mono text-xs">
                                            {node.last_heartbeat || 'Never'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pods Table */}
            <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Pods ({Object.keys(pods).length})</h2>
                    {loading && <span className="text-gray-500 text-sm">Updating...</span>}
                </div>

                {Object.keys(pods).length === 0 ? (
                    <p className="text-gray-500">No pods running. Launch a pod to get started.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pod ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(pods).map(([id, pod]) => (
                                <tr key={id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {pod.node_id || 'Unassigned'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {pod.cpu_required} core{pod.cpu_required !== 1 ? 's' : ''}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 text-xs rounded-full ${pod.status === 'running' ? 'bg-green-100 text-green-800' :
                                            pod.status === 'pending_reschedule' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {pod.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {pod.created_at || 'Unknown'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

ReactDOM.render(<ClusterDashboard />, document.getElementById('app'));