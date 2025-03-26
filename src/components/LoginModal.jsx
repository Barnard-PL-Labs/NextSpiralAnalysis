"use client";
import { useState,useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import Image from "next/image";
import { FaExclamationCircle } from 'react-icons/fa';



export default function LoginModal({ isOpen, closeModal }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message,setMessage] = useState("");
  const router = useRouter();
  const imageSource = "/Icons/generated-icon-removebg.png";

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Check your email to confirm your account!");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error){
        if (error.message === 'Invalid login credentials') {
            setMessage('Invalid email or password. Please try again.');
          } else if (error.message === 'Email not confirmed') {
            setMessage('Please confirm your email before logging in.');
          } else {
            setMessage('An unexpected error occurred. Please try again later.');
          }
    }
    else {
      alert("Logged in successfully!");
      closeModal();
      router.push("/machine");
    }
  };

  return (
    <Transition appear show={isOpen === true} as={Fragment}>
      <Dialog as="div"  onClose={closeModal} style={{position:'fixed', inset:'0',
    zIndex: 9999,
  }}>
        <div className="modal-wrapper">

          <Transition.Child
            as={Fragment}
            enter="modal-enter"
            enterFrom="modal-enter-from"
            enterTo="modal-enter-to"
            leave="modal-leave"
            leaveFrom="modal-leave-from"
            leaveTo="modal-leave-to"
          >

              <Dialog.Panel className="login-modal">
              <button
                type="button" className='closeButton'onClick={closeModal}>&times;</button>
                <div className="modal-header">
                  <Image src={imageSource} width={50} height={50} alt="Logo" priority />
                  <h2>Spiral Analysis</h2>
                </div>
                <h2 className="modal-title">Login</h2>
                <div className="modal-form-wrapper">
                <div className="modal-form">
                {message &&     <div className="error-container"><div className="icon-background"><FaExclamationCircle className="error-icon" /></div>
                <p className="error-text">{message}</p></div>}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button onClick={handleLogin} className="btn-primary">
                    Login
                  </button>
                  <button onClick={handleSignUp} className="btn-secondary">
                    Sign Up
                  </button>
                </div>
                
                <div className="vertical-divider"></div>

                <div className="modal-form-right">
                <Image src="/Icons/trueSpiralLogin.png" width={260} height={210} alt="SpiralPic"/>                    </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
      </Dialog>
    </Transition>
  );
}
