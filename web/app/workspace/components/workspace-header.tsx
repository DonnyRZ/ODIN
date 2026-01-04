'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import {
  clearActiveProjectId,
  clearWorkspaceProject,
  getAuthToken,
} from '@/lib/workspace-storage';

import { useWorkspaceProject } from '../hooks/use-workspace-project';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8800';

export function WorkspaceHeader() {
  const { project } = useWorkspaceProject();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('Authentication required.');
      }
      const response = await fetch(
        `${API_BASE_URL}/projects/${project.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      if (!response.ok) {
        throw new Error('Failed to delete project.');
      }
      clearWorkspaceProject();
      clearActiveProjectId();
      router.push('/');
    } catch {
      setDeleteError('Failed to delete the project. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-8 py-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Back
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{project.name}</p>
            <p className="text-xs text-gray-500">
              {project.autosaveStatus === 'saving' ? 'Saving changes...' : 'Autosave ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            onClick={() => {
              setIsDeleteOpen(true);
              setDeleteError(null);
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {isDeleteOpen && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-gray-900">Delete project</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Sure you want to delete this project? This cannot be undone.
                </p>
                {deleteError && <p className="mt-3 text-xs font-semibold text-red-600">{deleteError}</p>}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDeleteOpen(false)}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes'}
                  </button>
                </div>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </header>
  );
}
