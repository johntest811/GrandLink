"use client";
import { useState } from "react";

export default function ReservationForm() {
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    phone: "",
    email: "",
    storeBranch: "",
    typeOfProduct: "",
    productModel: "",
    width: "",
    height: "",
    thickness: "",
    construction: "",
    remarks: "",
    address: "",
    agree: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = e.target instanceof HTMLInputElement && type === "checkbox";
    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? e.target : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <section className="py-12 px-4 max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-xl p-8">
        <h2 className="text-2xl font-bold text-center mb-2">Reservation Form</h2>
        <p className="text-center text-gray-600 mb-8">
          Please fill out this form to book your appointment/reservation and we will contact you shortly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="name"
              placeholder="First Name"
              value={formData.name}
              onChange={handleChange}
              required
              className="border rounded-lg p-3 w-full"
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="border rounded-lg p-3 w-full"
            />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <span className="border rounded-lg p-3 bg-gray-100">+63</span>
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                required
                className="border rounded-lg p-3 w-full"
              />
            </div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="border rounded-lg p-3 w-full"
            />
          </div>

          {/* Store Branch */}
          <select
            name="storeBranch"
            value={formData.storeBranch}
            onChange={handleChange}
            required
            className="border rounded-lg p-3 w-full"
          >
            <option value="">Store Branch</option>
            <option value="quezon">Quezon City</option>
            <option value="antipolo">Antipolo City</option>
          </select>

          {/* Product Type & Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              name="typeOfProduct"
              value={formData.typeOfProduct}
              onChange={handleChange}
              required
              className="border rounded-lg p-3 w-full"
            >
              <option value="">Type of Product</option>
              <option value="door">Door</option>
              <option value="window">Window</option>
              <option value="glass">Glass Partition</option>
            </select>
            <input
              type="text"
              name="productModel"
              placeholder="Product Model"
              value={formData.productModel}
              onChange={handleChange}
              className="border rounded-lg p-3 w-full"
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="number"
              name="width"
              placeholder="Width"
              value={formData.width}
              onChange={handleChange}
              className="border rounded-lg p-3 w-full"
            />
            <input
              type="number"
              name="height"
              placeholder="Height"
              value={formData.height}
              onChange={handleChange}
              className="border rounded-lg p-3 w-full"
            />
            <input
              type="number"
              name="thickness"
              placeholder="Thickness"
              value={formData.thickness}
              onChange={handleChange}
              className="border rounded-lg p-3 w-full"
            />
          </div>

          {/* Construction */}
          <div>
            <p className="font-semibold mb-2">Construction (Optional)</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="construction"
                  value="new"
                  onChange={handleChange}
                /> New
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="construction"
                  value="renovation"
                  onChange={handleChange}
                /> Renovation
              </label>
            </div>
          </div>

          {/* Remarks */}
          <textarea
            name="remarks"
            placeholder="Remarks"
            value={formData.remarks}
            onChange={handleChange}
            className="border rounded-lg p-3 w-full"
            rows={3}
          />

          {/* Address */}
          <input
            type="text"
            name="address"
            placeholder="Address"
            value={formData.address}
            onChange={handleChange}
            className="border rounded-lg p-3 w-full"
          />

          {/* Agreement */}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="agree"
              checked={formData.agree}
              onChange={handleChange}
              required
            />
            <span className="text-sm">
              I have read the <a href="#" className="text-red-700 underline">Terms and Conditions</a>. By sending or saving my application, I agree to the Terms and Conditions.
            </span>
          </label>

          {/* Submit */}
          <div className="text-center">
            <button
              type="submit"
              className="bg-red-700 text-white px-8 py-3 rounded-lg hover:bg-red-800"
            >
              SUBMIT
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
