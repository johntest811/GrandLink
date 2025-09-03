"use client";
import { useEffect } from "react";
import { FaCheckCircle } from "react-icons/fa";

export default function RegisterSuccessPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "/login";
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <FaCheckCircle className="text-green-500 mb-4" size={80} />
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
        Registration Confirmed!
      </h2>
      <p className="mt-2 text-gray-600 text-center">
        Your account has been successfully created and confirmed.<br />
        Redirecting to login...
      </p>
    </div>
  );
}