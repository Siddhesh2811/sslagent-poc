import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  value?: File | File[] | null;
  onChange: (files: File | File[] | null) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  multiple = false,
  value,
  onChange,
  className,
  placeholder = "Click to upload or drag and drop",
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (multiple) {
      onChange(Array.from(files));
    } else {
      onChange(files[0] || null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files) return;

    if (multiple) {
      onChange(Array.from(files));
    } else {
      onChange(files[0] || null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index?: number) => {
    if (multiple && Array.isArray(value) && index !== undefined) {
      const newFiles = value.filter((_, i) => i !== index);
      onChange(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange(null);
    }
  };

  const getDisplayFiles = () => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const files = getDisplayFiles();

  return (
    <div className={cn("space-y-2", className)}>
      <Card
        className="border-2 border-dashed border-input hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="p-6 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">{placeholder}</p>
          <Button type="button" variant="outline" size="sm">
            Browse Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            className="hidden"
            required={required}
          />
        </div>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(multiple ? index : undefined);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};