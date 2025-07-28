import React from 'react';

export default function ProductsPage() {
  // Mock product data - in a real application, this would come from an API
  const products = [
    { id: 1, name: 'Aluminum Window Frame', category: 'Frames', price: 149.99, stock: 25, status: 'In Stock' },
    { id: 2, name: 'Tempered Glass Panel', category: 'Glass', price: 89.99, stock: 15, status: 'In Stock' },
    { id: 3, name: 'Sliding Door System', category: 'Doors', price: 299.99, stock: 8, status: 'Low Stock' },
    { id: 4, name: 'Shower Enclosure', category: 'Bathroom', price: 349.99, stock: 0, status: 'Out of Stock' },
    { id: 5, name: 'Glass Balustrade', category: 'Railings', price: 199.99, stock: 12, status: 'In Stock' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products Management</h1>
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Add New Product
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products..."
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <select className="p-2 border border-gray-300 rounded">
          <option value="">All Categories</option>
          <option value="frames">Frames</option>
          <option value="glass">Glass</option>
          <option value="doors">Doors</option>
          <option value="bathroom">Bathroom</option>
          <option value="railings">Railings</option>
        </select>
        <select className="p-2 border border-gray-300 rounded">
          <option value="">All Status</option>
          <option value="in-stock">In Stock</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-gray-500 text-xs">IMG</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">ID: {product.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{product.category}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${product.price.toFixed(2)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.stock}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.status === 'In Stock' ? 'bg-green-100 text-green-800' : product.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {product.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                  <button className="text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">1</span> to <span className="font-medium">5</span> of <span className="font-medium">5</span> results
        </div>
        <div className="flex-1 flex justify-end">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <a
              href="#"
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Previous
            </a>
            <a
              href="#"
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              1
            </a>
            <a
              href="#"
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Next
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}