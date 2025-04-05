const ClusterDashboard = () => {
    const [nodes, setNodes] = React.useState([]);
    const [pods, setPods] = React.useState([]);
    const [cpuCores, setCpuCores] = React.useState(2);
    const [cpuRequired, setCpuRequired] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [nodesRes, podsRes] = await Promise.all([
                fetch('/nodes'),
                fetch('/pods?list=true')
            ]);
            const nodesData = await nodesRes.json();
            const podsData = await podsRes.json();
            setNodes(nodesData.nodes || {});
            setPods(podsData.pods || {});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const addNode = async () => {
        try {
            const response = await fetch('/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpu_cores: cpuCores })
            });
            await fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    const launchPod = async () => {
        try {
            const response = await fetch('/pods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpu_required: cpuRequired })
            });
            await fetchData();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="space-y-8">
            <header className="bg-white shadow rounded-lg p-6">
                <h1 className="text-3xl font-bold text-gray-800">Cluster Management Dashboard</h1>
                <p className="text-gray-600">Monitor and manage distributed system cluster</p>
            </header>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                    <p>{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Node Management */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Node Management</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">CPU Cores</label>
                            <input
                                type="number"
                                min="1"
                                value={cpuCores}
                                onChange={(e) => setCpuCores(parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={addNode}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out"
                        >
                            Add Node
                        </button>
                    </div>
                </div>

                {/* Pod Management */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Pod Management</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">CPU Required</label>
                            <input
                                type="number"
                                min="1"
                                value={cpuRequired}
                                onChange={(e) => setCpuRequired(parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={launchPod}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out"
                        >
                            Launch Pod
                        </button>
                    </div>
                </div>
            </div>

            {/* Cluster Status */}
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Cluster Status</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-800 mb-2">Nodes ({Object.keys(nodes).length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(nodes).map(([id, node]) => (
                                    <div key={id} className={`border rounded-lg p-4 ${node.status === 'healthy' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-medium text-gray-800">{id}</h4>
                                            <span className={`px-2 py-1 text-xs rounded-full ${node.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {node.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                                            <p>CPU: {node.available_cpu}/{node.cpu_cores} cores available</p>
                                            <p>Pods: {node.pods.length}</p>
                                            <p>Last heartbeat: {node.last_heartbeat}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-gray-800 mb-2">Pods ({Object.keys(pods).length})</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pod ID</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU Required</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {Object.entries(pods).map(([id, pod]) => (
                                            <tr key={id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{id}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pod.node_id}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pod.cpu_required} cores</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${pod.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {pod.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

ReactDOM.render(<ClusterDashboard />, document.getElementById('app'));