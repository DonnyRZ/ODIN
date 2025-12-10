'use client';

import { ChangeEvent, useRef } from 'react';

type SlideUploadSectionProps = {
  slideImage?: string;
  isUploading: boolean;
  uploadError: string | null;
  onSelectFile: (file: File) => void | Promise<void>;
  onClearSlide: () => void;
};

export function SlideUploadSection({
  slideImage,
  isUploading,
  uploadError,
  onSelectFile,
  onClearSlide,
}: SlideUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSlide = Boolean(slideImage);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    // Reset input so the same file can be selected again after clearing
    event.target.value = '';
  };

  const triggerFileDialog = () => {
    inputRef.current?.click();
  };

  return (
    <section className="border-b border-gray-200 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Slide screenshot</p>
          <p className="text-sm text-gray-500">PNG or JPG up to 10MB</p>
        </div>
        <button
          type="button"
          onClick={triggerFileDialog}
          className="text-xs font-semibold text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          {hasSlide ? 'Replace' : 'Browse'}
        </button>
      </header>
      <div className="mt-4 space-y-4">
        <button
          type="button"
          onClick={triggerFileDialog}
          className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-600 transition hover:border-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
        >
          <span className="font-semibold text-gray-900">
            {hasSlide ? (isUploading ? 'Uploading…' : 'Slide uploaded') : 'Drag your slide image here'}
          </span>
          <span className="mt-1 text-xs text-gray-500">
            {hasSlide ? 'Click to replace or remove below' : 'or click to upload'}
          </span>
        </button>
        {hasSlide && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slideImage} alt="Uploaded slide preview" className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-500">
              <button
                type="button"
                onClick={triggerFileDialog}
                className="text-red-600 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={onClearSlide}
                className="text-gray-500 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {uploadError ? (
          <p className="text-xs font-semibold text-red-600">{uploadError}</p>
        ) : (
          <p className="text-xs text-gray-500">{isUploading ? 'Reading image…' : 'Supports .png / .jpg up to 10MB.'}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
        />
      </div>
    </section>
  );
}
