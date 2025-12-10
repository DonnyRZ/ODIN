type SlideUploadSectionProps = {
  hasSlide: boolean;
};

export function SlideUploadSection({ hasSlide }: SlideUploadSectionProps) {
  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Slide screenshot</p>
          <p className="text-sm text-gray-500">PNG or JPG only</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          {hasSlide ? 'Replace' : 'Browse'}
        </button>
      </header>
      <div className="mt-4 space-y-3">
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-600 hover:border-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
        >
          <span className="font-semibold text-gray-900">
            {hasSlide ? 'Slide uploaded' : 'Drag your slide image here'}
          </span>
          <span className="mt-1 text-xs text-gray-500">
            {hasSlide ? 'Drop a new image to replace it' : 'or click to upload'}
          </span>
        </button>
        <p className="text-xs text-gray-500">Supports .png / .jpg up to 10MB.</p>
      </div>
    </section>
  );
}
