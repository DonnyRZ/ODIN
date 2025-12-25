import Image from 'next/image';
import Link from 'next/link';

const projects = [
  {
    id: 'pitch-q1',
    name: 'Pitch Deck – Q1 2025',
    visuals: 12,
    updated: '3 hours ago',
    status: 'In progress'
  },
  {
    id: 'sales-europe',
    name: 'Sales Narrative – Europe',
    visuals: 8,
    updated: 'Yesterday',
    status: 'Completed'
  },
  {
    id: 'ops-weekly',
    name: 'Ops Weekly – April 2',
    visuals: 5,
    updated: '2 days ago',
    status: 'In progress'
  }
];

const steps: Array<[string, string]> = [
  ['Drop a slide', 'Upload a PNG/JPG of the slide you’re editing—ODIN ingests it instantly.'],
  ['Draw the empty area', 'Highlight the space you want to fill. ODIN snaps to square or 16:9 automatically.'],
  ['Describe the slide', 'Paste the title/body copy so ODIN captures the intent and language.'],
  ['Paste the result', 'Pick your favorite visual, copy to clipboard, and drop it straight into your deck.']
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex w-full items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3 font-semibold tracking-wide text-gray-900">
            <Image src="/logo.png" width={40} height={40} alt="ODIN logo" priority />
            <span>ODIN</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden md:inline">ACCOUNT MENU (coming soon)</span>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600"
              aria-label="User menu"
            >
              HC
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-16 px-8 py-12">
        <section className="text-center">
          <p className="mx-auto inline-flex items-center rounded-md bg-red-50 px-4 py-1 text-sm font-medium text-red-600">
            AI assistant for PowerPoint, Google Slides, & Canva
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold text-gray-900 md:text-5xl">
            Create pixel-perfect slide visuals in seconds
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Upload a slide screenshot, outline the empty space, and ODIN returns three visuals that match your copy, aspect ratio, and palette.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/workspace"
              className="rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              Start new project
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm font-medium text-red-600">
            <span className="rounded-full bg-red-50 px-4 py-2">Try sample project (coming soon)</span>
            <span className="rounded-full bg-red-50 px-4 py-2">Watch tutorial (coming soon)</span>
          </div>
        </section>

        <section aria-labelledby="recent-heading" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">Recent</p>
              <h2 id="recent-heading" className="text-2xl font-semibold text-gray-900">
                Projects
              </h2>
            </div>
            <span className="text-red-600">View all (coming soon)</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5 transition hover:-translate-y-0.5 hover:border-red-500"
              >
                <div>
                  <p className="text-sm font-semibold text-red-600">{project.status}</p>
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                </div>
                <p className="text-sm text-gray-500">
                  {project.updated} · {project.visuals} visuals
                </p>
                <span className="inline-flex items-center rounded-md bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                  Continue (placeholder)
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-red-50 p-8" aria-labelledby="how-heading">
          <p className="text-xs uppercase tracking-widest text-gray-500">How it works</p>
          <h2 id="how-heading" className="mt-2 text-2xl font-semibold text-gray-900">
            The 30-second ODIN flow
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, copy]) => (
              <article key={title} className="rounded-xl border border-gray-200 bg-white p-4 text-left">
                <h3 className="text-lg font-semibold text-red-600">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ODIN. All rights reserved.
      </footer>
    </div>
  );
}
