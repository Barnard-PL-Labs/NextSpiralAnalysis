"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "../../styles/Settings.module.css";
import Sidebar from "../../components/SideBar";

export default function Settings() {
    const router = useRouter();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Redirect to login if not authenticated
    useEffect(() => {
        const checkUserAuth = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                router.push("/login");
            }
        };

        checkUserAuth();
    }, [router]);

    // Handle password change with old password verification
    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            // Re-authenticate user with the old password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: supabase.auth.user().email,
                password: oldPassword,
            });

            if (signInError) {
                setMessage(`Error: ${signInError.message}`);
                setLoading(false);
                return;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                setMessage(`Error: ${updateError.message}`);
            } else {
                setMessage("Password updated successfully!");
                setOldPassword("");
                setNewPassword("");
            }
        } catch (error) {
            setMessage(`Unexpected error: ${error.message}`);
        }

        setLoading(false);
    };

    // Handle user sign out
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    // Handle account deletion
    const handleDeleteAccount = async () => {
        const confirmDelete = confirm("Are you sure you want to delete your account?");
        if (confirmDelete) {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", user.id);

            if (error) {
                setMessage(`Error: ${error.message}`);
            } else {
                await supabase.auth.signOut();
                router.push("/login");
            }
        }
    };

    return (
        <div>
            <Sidebar />

            <div className={styles.settingsContainer}>
                <h2 className={styles.settingsHeader}>Account Settings</h2>

                <form onSubmit={handlePasswordChange} className={styles.settingsForm}>
                    <label className={styles.settingsLabel}>
                        Current Password:
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className={styles.settingsInput}
                            required
                        />
                    </label>

                    <label className={styles.settingsLabel}>
                        New Password:
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={styles.settingsInput}
                            required
                        />
                    </label>

                    <button type="submit" disabled={loading} className={styles.settingsButton}>
                        Change Password
                    </button>
                </form>

                <button onClick={handleSignOut} className={styles.settingsButton}>
                    Sign Out
                </button>

                <button className={styles.settingsDeleteBtn} onClick={handleDeleteAccount}>
                    Delete Account
                </button>

                {message && (
                    <p className={`${styles.settingsMessage} ${message.includes("Error") ? styles.errorMessage : styles.successMessage}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
