'use client';

import { useState } from 'react';

export default function InquirePage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    service: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
    alert('Thank you! We’ll get back to you shortly.');
  };

  return (
    <div className="bg-white text-gray-800">
      {/* Form Card */}
      <section className="py-12 px-4 max-w-6xl mx-auto">
  <div className="bg-white shadow-lg rounded-xl p-8 grid md:grid-cols-2 gap-8 items-start">
    {/* LEFT SIDE: Heading and Description */}
    <div>
      <h2 className="text-3xl font-bold text-red-700 mb-4">Inquire Now</h2>
      <p className="text-gray-700 text-base leading-relaxed">
        We’re happy to help you bring your vision to life. Kindly provide us with your
        requirements and contact information below. Our team will get back to you as
        soon as possible.
      </p>

      <div className="mt-6 text-sm text-gray-600 space-y-1">
        <p><strong>Phone:</strong> 0927‑574‑9475</p>
        <p><strong>Email:</strong> grand‑east@gmail.com</p>
        <p><strong>Facebook:</strong> facebook.com/grandeast</p>
      </div>
    </div>

    {/* RIGHT SIDE: Form */}
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          name="firstName"
          onChange={handleChange}
          value={formData.firstName}
          required
          className="border rounded-lg p-3"
          placeholder="First Name"
        />
        <input
          name="lastName"
          onChange={handleChange}
          value={formData.lastName}
          required
          className="border rounded-lg p-3"
          placeholder="Last Name"
        />
      </div>
      <input
        name="email"
        onChange={handleChange}
        value={formData.email}
        type="email"
        required
        className="border rounded-lg p-3"
        placeholder="Email"
      />
      <input
        name="phone"
        onChange={handleChange}
        value={formData.phone}
        required
        className="border rounded-lg p-3"
        placeholder="Phone"
      />
      <select
        name="service"
        onChange={handleChange}
        value={formData.service}
        required
        className="border rounded-lg p-3"
      >
        <option value="">What is your inquiry about?</option>
        <option value="windows">Windows</option>
        <option value="doors">Doors</option>
        <option value="glass partitions">Glass Partitions</option>
        <option value="curtain wall">Curtain Wall</option>
        <option value="custom design">Custom Design</option>
      </select>
      <textarea
        name="message"
        onChange={handleChange}
        value={formData.message}
        required
        rows={4}
        className="border rounded-lg p-3"
        placeholder="Message"
      />
      <button
        type="submit"
        className="bg-red-700 text-white rounded-lg py-3 px-6 hover:bg-red-800"
      >
        Send
      </button>
    </form>
  </div>
</section>


      {/* Map Section */}
      <section className="my-12">
        <iframe
          src="https://www.google.com/maps/d/u/0/embed?mid=1ghVaKLQIj0GoKnNNVL2cr7duCQMC-B4&ehbc=2E312F"
          width="100%"
          height="500"
          allowFullScreen
          loading="lazy"
          className="w-full border-none"
        ></iframe>
      </section>

      {/* Background section below map */}
      <div className="h-[250px] bg-cover bg-center opacity-80" style={{ backgroundImage: "url('/images/city-night.jpg')" }}></div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white text-sm py-10 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-bold mb-2">About Us</h4>
            <p>Showrooms</p>
            <p>Locations</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">Services We Offer</h4>
            <p>List of Services</p>
            <p>Featured Projects</p>
            <p>Delivery & Order Process</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">Products</h4>
            <p>Doors</p>
            <p>Enclosures</p>
            <p>Windows</p>
            <p>Railings</p>
            <p>Canopy</p>
            <p>Curtain Wall</p>
          </div>
          <div>
            <h4 className="font-bold mb-2">FAQs</h4>
          </div>
        </div>
        <div className="flex justify-between items-center mt-8 px-2 text-xs">
          <p>© Grand East | Globe Fiber | 0927-574-9475</p>
          <button className="bg-red-700 text-white px-4 py-1 rounded hover:bg-red-800">INQUIRE NOW</button>
        </div>
      </footer>
    </div>
  );
}
