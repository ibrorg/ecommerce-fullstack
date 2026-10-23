import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import TableSkeleton from '../TableSkeleton';
import {
  FiSearch,
  FiTrash2,
  FiAlertCircle,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiUsers,
  FiLoader,
  FiFilter,
  FiShield,
} from 'react-icons/fi';

// ---- Types ----

interface AdminUser {
  _id: string;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
  avatar?: string;
  createdAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface UsersResponse {
  users: AdminUser[];
  pagination: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 20;

const ROLE_OPTIONS = ['buyer', 'seller', 'admin'] as const;

const ROLE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Buyer', value: 'buyer' },
  { label: 'Seller', value: 'seller' },
  { label: 'Admin', value: 'admin' },
] as const;

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
] as const;

const getDisplayName = (user: AdminUser): string => {
  if (user.name) return user.name;
  const first = user.firstName || '';
  const last = user.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || user.email || 'Unknown user';
};

const getInitials = (user: AdminUser): string => {
  const name = getDisplayName(user);
  if (name === 'Unknown user') return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase()
  );
};

const getUserStatus = (user: AdminUser): string => {
  if (user.status) return user.status.toLowerCase();
  return user.isActive === false ? 'suspended' : 'active';
};

const getRoleClasses = (role?: string): string => {
  const r = (role || 'buyer').toLowerCase();
  switch (r) {
    case 'admin':
      return 'bg-purple-100 text-purple-700';
    case 'seller':
      return 'bg-blue-100 text-blue-700';
    case 'buyer':
    case 'user':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getStatusClasses = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';
    case 'suspended':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

/**
 * Backend may return either an envelope { success, data } or a raw payload.
 */
function unwrap<T>(responseData: unknown, fallback: T): T {
  if (
    responseData &&
    typeof responseData === 'object' &&
    !Array.isArray(responseData) &&
    'success' in responseData
  ) {
    const env = responseData as ApiEnvelope<T>;
    return env.data ?? fallback;
  }
  return (responseData as T | undefined) ?? fallback;
}

// ---- Component ----

const AdminUsers: React.FC = () => {
  const currentUser = useAppSelector((state) => state.auth.user);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Inline edits per user id
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (page: number, search: string, role: string, status: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (search.trim()) params.set('search', search.trim());
        if (role) params.set('role', role);
        if (status) params.set('status', status);
        const response = await api.get(`/api/users?${params.toString()}`);
        const data = unwrap<UsersResponse>(response.data, {
          users: [],
          pagination: { page, limit: PAGE_SIZE, total: 0, pages: 1 },
        });
        const list = Array.isArray(data)
          ? (data as unknown as AdminUser[])
          : data.users || [];
        const pg = Array.isArray(data)
          ? { page, limit: PAGE_SIZE, total: list.length, pages: 1 }
          : data.pagination || {
              page,
              limit: PAGE_SIZE,
              total: list.length,
              pages: 1,
            };
        setUsers(list);
        setPagination(pg);
      } catch (err) {
        const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
        setError(
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Unable to load users. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchUsers(1, searchTerm, roleFilter, statusFilter);
  }, [fetchUsers, searchTerm, roleFilter, statusFilter]);

  const handlePrev = () => {
    if (pagination.page > 1) {
      fetchUsers(pagination.page - 1, searchTerm, roleFilter, statusFilter);
    }
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) {
      fetchUsers(pagination.page + 1, searchTerm, roleFilter, statusFilter);
    }
  };

  const handleApplySearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setRoleFilter('');
    setStatusFilter('');
  };

  // Defensive: compare current user against both _id and id fields
  const isSelf = (user: AdminUser): boolean => {
    if (!currentUser) return false;
    const currentId = currentUser.id;
    if (!currentId) return false;
    return user._id === currentId || user.id === currentId;
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setRoleEdits((prev) => ({ ...prev, [userId]: newRole }));
    setInlineError(null);
  };

  const handleSaveRole = async (user: AdminUser) => {
    const newRole = roleEdits[user._id];
    if (!newRole) return;
    const currentRole = (user.role || 'buyer').toLowerCase();
    if (newRole === currentRole) return;
    setSavingId(user._id);
    setInlineError(null);
    try {
      const response = await api.put(`/api/users/${user._id}`, {
        role: newRole,
      });
      const body = response.data;
      let ok = true;
      let msg: string | undefined;
      if (body && typeof body === 'object' && 'success' in body) {
        const env = body as ApiEnvelope<unknown>;
        ok = env.success !== false;
        msg = env.message || env.error;
      }
      if (!ok) {
        setInlineError(msg || 'Failed to update role');
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id ? { ...u, role: newRole } : u,
        ),
      );
      setRoleEdits((prev) => {
        const next = { ...prev };
        delete next[user._id];
        return next;
      });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setInlineError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to update user role. Please try again.',
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (isSelf(user)) return;
    const currentStatus = getUserStatus(user);
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setSavingId(user._id);
    setInlineError(null);
    try {
      const response = await api.put(`/api/users/${user._id}`, {
        status: nextStatus,
      });
      const body = response.data;
      let ok = true;
      let msg: string | undefined;
      if (body && typeof body === 'object' && 'success' in body) {
        const env = body as ApiEnvelope<unknown>;
        ok = env.success !== false;
        msg = env.message || env.error;
      }
      if (!ok) {
        setInlineError(msg || 'Failed to update user status');
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? { ...u, status: nextStatus, isActive: nextStatus === 'active' }
            : u,
        ),
      );
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setInlineError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to update user status. Please try again.',
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/users/${deleteTarget._id}`);
      setDeleteTarget(null);
      const remaining = users.length - 1;
      const targetPage =
        remaining === 0 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchUsers(targetPage, searchTerm, roleFilter, statusFilter);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setDeleteError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to delete user. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ---- Render: loading ----
  if (loading && users.length === 0) {
    return <TableSkeleton rowCount={6} titleWidth="w-56" />;
  }

  // ---- Render: error ----
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-6 text-center">
          <FiAlertCircle className="mx-auto text-red-600 dark:text-red-400 mb-3" size={32} />
          <h2 className="text-lg font-semibold text-red-900 mb-1">
            Something went wrong
          </h2>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button
            onClick={() =>
              fetchUsers(pagination.page, searchTerm, roleFilter, statusFilter)
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <FiRefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">
            <Link to="/admin/dashboard" className="hover:text-gray-700">
              Admin Dashboard
            </Link>{' '}
            / Users
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Manage Users
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {pagination.total > 0
              ? `${pagination.total} user${pagination.total === 1 ? '' : 's'} registered on the marketplace`
              : 'All registered users will appear here'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <FiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplySearch();
              }}
              placeholder="Search by email..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <FiFilter className="text-gray-400" size={16} />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ROLE_FILTERS.map((f) => (
                  <option key={f.value || 'all-roles'} value={f.value}>
                    {f.label === 'All' ? 'All roles' : f.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value || 'all-statuses'} value={f.value}>
                    {f.label === 'All' ? 'All statuses' : f.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApplySearch}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
            {(searchTerm || roleFilter || statusFilter) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {inlineError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <FiAlertCircle
              className="text-red-600 flex-shrink-0 mt-0.5"
              size={16}
            />
            <p className="text-sm text-red-700">{inlineError}</p>
          </div>
        )}

        {users.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiUsers className="mx-auto text-gray-300 mb-4" size={40} />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No users found
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm || roleFilter || statusFilter
                ? 'Try adjusting your search or filters.'
                : 'Registered users will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Users table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((user) => {
                      const status = getUserStatus(user);
                      const self = isSelf(user);
                      const editedRole = roleEdits[user._id];
                      const currentRole = (user.role || 'buyer').toLowerCase();
                      const roleChanged =
                        editedRole && editedRole !== currentRole;
                      return (
                        <tr key={user._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={getDisplayName(user)}
                                  className="w-9 h-9 rounded-full object-cover bg-gray-100"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display =
                                      'none';
                                  }}
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold">
                                  {getInitials(user)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {getDisplayName(user)}
                                </p>
                                {self && (
                                  <p className="text-xs text-blue-600 inline-flex items-center gap-1">
                                    <FiShield size={10} />
                                    You
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {user.email || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {self ? (
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getRoleClasses(
                                    user.role,
                                  )}`}
                                >
                                  {user.role || 'buyer'}
                                </span>
                              ) : (
                                <>
                                  <select
                                    value={editedRole ?? currentRole}
                                    onChange={(e) =>
                                      handleRoleChange(user._id, e.target.value)
                                    }
                                    disabled={savingId === user._id}
                                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                  >
                                    {ROLE_OPTIONS.map((r) => (
                                      <option key={r} value={r}>
                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                  {roleChanged && (
                                    <button
                                      onClick={() => handleSaveRole(user)}
                                      disabled={savingId === user._id}
                                      className="px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                    >
                                      {savingId === user._id ? 'Saving...' : 'Save'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusClasses(
                                status,
                              )}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={self || savingId === user._id}
                                className="px-2 py-1 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title={
                                  self
                                    ? 'You cannot suspend yourself'
                                    : status === 'active'
                                      ? 'Suspend user'
                                      : 'Reactivate user'
                                }
                              >
                                {status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget(user);
                                }}
                                disabled={self}
                                className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Delete ${getDisplayName(user)}`}
                                title={
                                  self
                                    ? 'You cannot delete yourself'
                                    : 'Delete user'
                                }
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {Math.max(pagination.pages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={pagination.page <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={handleNext}
                  disabled={pagination.page >= pagination.pages || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
            {loading && (
              <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1">
                <FiLoader className="animate-spin" size={12} />
                Loading...
              </p>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
                  <FiAlertCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete user?
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-gray-900">
                      {getDisplayName(deleteTarget)}
                    </span>
                    ? This soft-deletes the account and cannot be undone from
                    this view.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{deleteError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FiTrash2 size={16} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
