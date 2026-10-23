import React, { useState, useEffect } from 'react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { getCurrentUser, updateProfile, clearError } from '../../store/slices/authSlice';
import AddressBook from '../../components/AddressBook';
import { FiUser, FiMail, FiCalendar, FiSave, FiLock, FiEdit2, FiAlertCircle, FiCheck } from 'react-icons/fi';

const Profile: React.FC = () => {
  const dispatch = useAppDispatch();
  useDocumentMeta({ title: 'Profile', description: 'Manage your account settings and addresses.' });
  const { user, isLoading, error } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (!user) {
      dispatch(getCurrentUser());
    } else {
      setFormData({
        name: user.name,
        email: user.email,
      });
    }
  }, [user, dispatch]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      await dispatch(updateProfile(formData)).unwrap();
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      // Error is handled by the slice
      console.error('Profile update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
      });
    }
    setIsEditing(false);
    dispatch(clearError());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <div className="inline-block mb-6">
            <div className="animate-spin rounded-full h-16 w-16 sm:h-20 sm:w-20 border-4 border-gray-200 border-t-black"></div>
          </div>
          <p className="text-lg sm:text-xl text-gray-600 font-semibold">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl sm:text-7xl mb-6">🔐</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">User not found</h2>
          <p className="text-base sm:text-lg text-gray-600">Please try logging in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-50 rounded-full -mr-48 -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gray-50 rounded-full -ml-36 -mb-36 pointer-events-none" />
      
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 relative">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-10 sm:mb-14">
            <div className="flex items-center gap-3 mb-4">
              <FiUser className="text-black" size={32} />
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">Profile Settings</h1>
            </div>
            <p className="text-base sm:text-lg text-gray-600">Manage your account information and preferences</p>
          </div>

          {/* Main Profile Card */}
          <div className="p-6 sm:p-8 lg:p-12 rounded-2xl lg:rounded-3xl shadow-lg border border-gray-200 mb-8 bg-white">
            {/* Success Message */}
            {saveSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                <FiCheck className="text-green-600 flex-shrink-0" size={20} />
                <p className="text-green-800 font-medium">Profile updated successfully!</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                <FiAlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
              {/* Avatar Section */}
              <div className="md:col-span-1">
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FiUser className="w-16 sm:w-20 h-16 sm:h-20 text-gray-400" />
                    )}
                  </div>
                  <button className="mt-6 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold bg-white border-2 border-gray-300 text-gray-900 hover:border-gray-400 transition-colors">
                    <FiEdit2 size={16} />
                    <span className="hidden sm:inline">Change Avatar</span>
                    <span className="sm:hidden">Avatar</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-3 text-center">JPG, PNG up to 5MB</p>
                </div>
              </div>

              {/* Profile Form */}
              <div className="md:col-span-3">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest">
                      Full Name
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full pl-12 pr-4 py-4 text-base border-2 rounded-xl transition-all ${
                          isEditing 
                            ? 'border-gray-300 focus:border-black focus:outline-none hover:border-gray-400 bg-white' 
                            : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest">
                      Email Address
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className={`w-full pl-12 pr-4 py-4 text-base border-2 rounded-xl transition-all ${
                          isEditing 
                            ? 'border-gray-300 focus:border-black focus:outline-none hover:border-gray-400 bg-white' 
                            : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        }`}
                      />
                    </div>
                    {!user.isEmailVerified && (
                      <p className="mt-3 text-sm text-amber-600 font-semibold flex items-center gap-2">
                        ⚠️ Email not verified. <button type="button" className="underline font-bold hover:text-amber-700">Resend verification</button>
                      </p>
                    )}
                  </div>

                  {/* Role Badge */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest">
                      Account Role
                    </label>
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-black text-white">
                      <span>
                        {user.role === 'admin' ? '👑 Admin' : user.role === 'seller' ? '🏪 Seller' : '👤 Customer'}
                      </span>
                    </div>
                  </div>

                  {/* Created At */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest">
                      Member Since
                    </label>
                    <div className="flex items-center gap-3 text-base text-gray-900 font-semibold p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <FiCalendar size={20} />
                      <span>
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-8 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {isEditing ? (
                        <>
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base bg-black text-white hover:bg-gray-900 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl group disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <FiSave size={20} />
                                Save Changes
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base bg-white border-2 border-gray-300 text-gray-900 hover:border-gray-400 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base bg-black text-white hover:bg-gray-900 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl group"
                        >
                          <FiEdit2 size={20} />
                          Edit Profile
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base bg-white border-2 border-gray-300 text-gray-900 hover:border-gray-400 active:scale-95 transition-all duration-200"
                    >
                      <FiLock size={20} />
                      Change Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Address Book — multiple saved addresses with default shipping/billing */}
          <AddressBook />

          {/* Account Actions - Danger Zone */}
          <div className="p-6 sm:p-8 lg:p-10 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-3xl">⚠️</div>
              <div>
                <h2 className="text-2xl font-bold text-red-900 mb-2">Danger Zone</h2>
                <p className="text-red-800 font-medium">Once you delete your account, there is no going back. Please be certain.</p>
              </div>
            </div>
            <button className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-red-700 hover:text-red-800 bg-white border-2 border-red-400 hover:border-red-500 font-bold text-base transition-all duration-200 hover:shadow-md">
              <FiTrash2 size={20} />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;