import { useState } from 'react';
import api from '../services/api';

export default function AIQuery() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponse('');

    try {
      const res = await api.post('/ai/query', { query });
      setResponse(res.data.response);
    } catch (error) {
      setResponse('Error: ' + (error.response?.data?.detail || 'Failed to process query'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">AI Query</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ask a question about your WorkSpaces
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              rows="4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., How many workspaces are currently running?"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Submit Query'}
          </button>
        </form>

        {response && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Response:</h3>
            <p className="text-gray-900 whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </div>
    </div>
  );
}
