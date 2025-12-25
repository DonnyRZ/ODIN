import { FormEvent, useEffect, useState } from 'react';

type ProjectInfoSectionProps = {
  name: string;
  autosaveStatus: string;
  createdAt: string;
  onRename: (value: string) => void;
};

const createdFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatCreatedLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Created just now';
  }

  return `Created ${createdFormatter.format(date)}`;
};

export function ProjectInfoSection({ name, autosaveStatus, createdAt, onRename }: ProjectInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(name);
    }
  }, [name, isEditing]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRename(draftName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftName(name);
    setIsEditing(false);
  };

  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Project</p>
        <button
          type="button"
          onClick={isEditing ? handleCancel : () => setIsEditing(true)}
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          {isEditing ? 'Cancel' : 'Rename'}
        </button>
      </header>
      <div className="mt-4 space-y-2">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              name="project-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              autoFocus
              placeholder="Project name"
              className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Save name
              </button>
              <p className="text-xs text-gray-500">Press Enter to save</p>
            </div>
          </form>
        ) : (
          <p className="text-lg font-semibold text-gray-900">{name}</p>
        )}
        <p className="text-sm text-gray-600">
          {autosaveStatus === 'saving' ? 'Saving changes...' : 'Autosave ready'}
        </p>
        <p className="text-xs text-gray-400">{formatCreatedLabel(createdAt)}</p>
      </div>
    </section>
  );
}
