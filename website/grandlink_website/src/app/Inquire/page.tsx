'use client';

import { useState } from 'react';
import { supabase } from "@/lib/supabaseClient";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

export default function InquirePage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    service: '',
    message: '',
  });

   const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("inquiries").insert([
      {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        service: formData.service,
        message: formData.message,
      },
    ]);

    setLoading(false);

    if (error) {
      console.error("Error saving inquiry:", error.message);
      alert("Something went wrong. Please try again.");
    } else {
      alert("Thank you! Your inquiry has been submitted.");
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        service: '',
        message: '',
      });
    }
  };

  return (
    <div className="bg-white text-gray-800">
      <TopNavBarLoggedIn />

      {/* Form Card */}
      <section className="py-12 px-4 max-w-6xl mx-auto">
        <div className="bg-white shadow-lg rounded-xl p-8 grid md:grid-cols-2 gap-8 items-start">
          {/* LEFT */}
          <div>
            <h2 className="text-3xl font-bold text-red-700 mb-4">Inquire Now</h2>
            <p className="text-gray-700">
              We’re happy to help you bring your vision to life. Provide your details below and our team will get back to you shortly.

            </p>
            <div className="mt-6 text-sm text-gray-600 space-y-1">
              <p><strong>Phone:</strong> 0927-574-9475</p>
              <p><strong>Email:</strong> grand-east@gmail.com</p>
              <p><strong>Facebook:</strong> facebook.com/grandeast</p>
            </div>
          </div>



          {/* RIGHT: Form */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName" value={formData.firstName} onChange={handleChange} required className="border rounded-lg p-3" placeholder="First Name"/>
              <input name="lastName" value={formData.lastName} onChange={handleChange} required className="border rounded-lg p-3" placeholder="Last Name"/>
            </div>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required className="border rounded-lg p-3" placeholder="Email"/>
            <input name="phone" value={formData.phone} onChange={handleChange} required className="border rounded-lg p-3" placeholder="Phone"/>
            <select name="service" value={formData.service} onChange={handleChange} required className="border rounded-lg p-3">
              <option value="">What is your inquiry about?</option>
              <option value="windows">Windows</option>
              <option value="doors">Doors</option>
              <option value="glass partitions">Glass Partitions</option>
              <option value="curtain wall">Curtain Wall</option>
              <option value="custom design">Custom Design</option>
            </select>
            <textarea name="message" rows={4} value={formData.message} onChange={handleChange} required className="border rounded-lg p-3" placeholder="Message"/>
            <button type="submit" disabled={loading} className="bg-red-700 text-white rounded-lg py-3 px-6 hover:bg-red-800">
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </section>

{/* Map Section */}
<section className="my-12">
  <iframe
    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d123579.55165295849!2d121.07049525820314!3d14.549940900000008!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c78cec7eb527%3A0x344e5006fbe9b0d!2sGRAND%20EAST%20TAYTAY%20GLASS%20AND%20ALUMINUM!5e0!3m2!1sfil!2snl!4v1757552625032!5m2!1sfil!2snl"
    width="100%"
    height="500"
    style={{ border: 0 }}
    allowFullScreen
    loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"
    className="w-full border-none"
  ></iframe>
</section>


      {/* Background section below map */}
      <div className="h-[250px] bg-cover bg-center opacity-80" style={{ backgroundImage: "url('/images/city-night.jpg')" }}></div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
