import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CrtKeyUploaderForm {
  existingCrt: File | null;
  existingKey: File | null;
}

const CrtKeyUploader: React.FC = () => {
  const { toast } = useToast();
  const { handleSubmit, setValue, watch } = useForm<CrtKeyUploaderForm>({
    defaultValues: { existingCrt: null, existingKey: null }
  });

  const existingCrt = watch('existingCrt');
  const existingKey = watch('existingKey');

  const onSubmit = (data: CrtKeyUploaderForm) => {
    console.log('CRT & KEY Upload Request:', data);
    toast({
      title: "Files uploaded successfully",
      description: "Your .crt and .key files have been uploaded successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Upload className="h-8 w-8" />
          CRT & KEY Uploader
        </h1>
        <p className="text-muted-foreground">Upload existing certificate and key files</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Existing .crt File *</Label>
              <FileUpload
                accept=".crt"
                value={existingCrt}
                onChange={(file) => setValue('existingCrt', file as File | null)}
                placeholder="Upload existing .crt file"
                required
              />
              {!existingCrt && <p className="text-sm text-destructive">Existing .crt file is required</p>}
            </div>

            <div>
              <Label>Existing .key File *</Label>
              <FileUpload
                accept=".key"
                value={existingKey}
                onChange={(file) => setValue('existingKey', file as File | null)}
                placeholder="Upload existing .key file"
                required
              />
              {!existingKey && <p className="text-sm text-destructive">Existing .key file is required</p>}
            </div>

            <Button type="submit" className="bg-gradient-primary hover:bg-primary-glow">
              Upload Files
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrtKeyUploader;