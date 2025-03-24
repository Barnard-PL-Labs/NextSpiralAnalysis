// // "use client";
// // import { useState } from "react";
// // import { supabase } from "@/lib/supabaseClient";
// // import { useRouter } from "next/navigation";
// // import Header from '@/components/Header';
// // import Image from "next/image";

// // const LoginPage = () => {
// //   const [email, setEmail] = useState("");
// //   const [password, setPassword] = useState("");
// //   const router = useRouter();

// //   const handleSignUp = async () => {
// //     const { error } = await supabase.auth.signUp({ email, password });
// //     if (error) alert(error.message);
// //     else alert("Check your email to confirm your account!");
// //   };

// //   const handleLogin = async () => {
// //     const { error } = await supabase.auth.signInWithPassword({ email, password });
// //     if (error) alert(error.message);
// //     else {
// //       alert("Logged in successfully!");
// //       router.push("/machine"); 
// //     }
// //   };

// //   return (
// //     <div>
// //     <Header showVideo ={false}/>
// //     <div className="loginContainer">
// //       <div className='loginBox'>
// //       <div className="loginHeader">
// //       <Image src="/Icons/generated-icon-removebg.png" width={50} height={50} alt="Logo" priority /><h3>Spiral Analysis</h3>
// //       </div>
// //       <div className="login">
// //         <h2>Login</h2>
// //       <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
// //       <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
// //       <button onClick={handleLogin}>Login</button>
// //       <button onClick={handleSignUp}>Sign Up</button>
// //       </div>

// //     </div>
// //     </div>
// //     </div>
// //   );
// // };
// // //Main idea for login is that instead of a separte page, it is just popping up when we click on it.
// // export default LoginPage;


// "use client";
// import { useState } from "react";
// import { supabase } from "@/lib/supabaseClient";
// import { useRouter } from "next/navigation";
// import { Dialog, Transition } from "@headlessui/react";
// import { Fragment } from "react";
// import Image from "next/image";

// export default function LoginModal({ isOpen, closeModal }) {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const router = useRouter();

//   const handleSignUp = async () => {
//     const { error } = await supabase.auth.signUp({ email, password });
//     if (error) alert(error.message);
//     else alert("Check your email to confirm your account!");
//   };

//   const handleLogin = async () => {
//     const { error } = await supabase.auth.signInWithPassword({ email, password });
//     if (error) alert(error.message);
//     else {
//       alert("Logged in successfully!");
//       closeModal();
//       router.push("/machine"); 
//     }
//   };

//   return (
//     <Transition appear show={isOpen === true} as={Fragment}>
//       <Dialog as="div" className="relative z-10" onClose={closeModal}>
//         <Transition.Child
//           as={Fragment}
//           enter="ease-out duration-300"
//           enterFrom="opacity-0"
//           enterTo="opacity-100"
//           leave="ease-in duration-200"
//           leaveFrom="opacity-100"
//           leaveTo="opacity-0"
//         >
//           <div className="fixed inset-0 bg-black bg-opacity-50" />
//         </Transition.Child>

//         <div className="fixed inset-0 overflow-y-auto">
//           <div className="flex min-h-full items-center justify-center p-4">
//             <Transition.Child
//               as={Fragment}
//               enter="ease-out duration-300"
//               enterFrom="opacity-0 scale-95"
//               enterTo="opacity-100 scale-100"
//               leave="ease-in duration-200"
//               leaveFrom="opacity-100 scale-100"
//               leaveTo="opacity-0 scale-95"
//             >
//               <Dialog.Panel className="w-full max-w-md rounded-xl bg-gray-800 px-6 py-8 shadow-xl">
//                 <div className="flex items-center justify-center gap-2 mb-4">
//                   <Image src="/Icons/generated-icon-removebg.png" width={50} height={50} alt="Logo" priority />
//                   <h3 className="text-xl font-semibold text-white">Spiral Analysis</h3>
//                 </div>
//                 <h2 className="text-center text-lg font-medium text-gray-200">Login</h2>

//                 <div className="mt-4 flex flex-col gap-3">
//                   <input
//                     type="email"
//                     placeholder="Email"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     className="w-full px-4 py-2 bg-gray-700 rounded-md text-white placeholder-gray-400 outline-none"
//                   />
//                   <input
//                     type="password"
//                     placeholder="Password"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     className="w-full px-4 py-2 bg-gray-700 rounded-md text-white placeholder-gray-400 outline-none"
//                   />
//                   <button
//                     onClick={handleLogin}
//                     className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition"
//                   >
//                     Login
//                   </button>
//                   <button
//                     onClick={handleSignUp}
//                     className="bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-md transition"
//                   >
//                     Sign Up
//                   </button>
//                 </div>

//                 <button
//                   className="mt-4 text-sm text-gray-400 hover:text-white transition"
//                   onClick={() => alert("Password reset functionality goes here!")}
//                 >
//                   Forgot Password?
//                 </button>
//               </Dialog.Panel>
//             </Transition.Child>
//           </div>
//         </div>
//       </Dialog>
//     </Transition>
//   );
// }
