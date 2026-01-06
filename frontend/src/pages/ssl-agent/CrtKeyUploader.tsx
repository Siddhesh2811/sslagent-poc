import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CrtKeyUploaderForm {
  existingCrt: File | null;
  existingKey: File | null;
  appName: string;
  appOwner: string;
  appSPOC: string;
  remarks: string;
  ca: string;
}

const CrtKeyUploader: React.FC = () => {
  const { toast } = useToast();
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CrtKeyUploaderForm>({
    defaultValues: {
      existingCrt: null,
      existingKey: null,
      ca: "Imported"
    }
  });

  const existingCrt = watch('existingCrt');
  const existingKey = watch('existingKey');

  const onSubmit = async (data: CrtKeyUploaderForm) => {
    try {
      if (!data.existingCrt || !data.existingKey) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Both CRT and Key files are required.",
        });
        return;
      }

      const formData = new FormData();
      formData.append('existingCrt', data.existingCrt);
      formData.append('existingKey', data.existingKey);
      formData.append('appName', data.appName);
      formData.append('appOwner', data.appOwner);
      formData.append('appSPOC', data.appSPOC);
      formData.append('remarks', data.remarks);
      formData.append('ca', data.ca);

      const response = await fetch('http://localhost:5000/api/certificates/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();

      toast({
        title: "Import Successful",
        description: `Certificate for ${result.dns} has been imported successfully.`,
      });
    } catch (error) {
      console.error('Import Error:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Upload className="h-8 w-8" />
          CRT & KEY Uploader
        </h1>
        <p className="text-muted-foreground">Import an existing certificate pair into the system</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Certificate Details & Files</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appName">Application Name *</Label>
                <Input {...register('appName', { required: 'Application Name is required' })} placeholder="e.g. Employee Portal" />
                {errors.appName && <p className="text-sm text-destructive">{errors.appName.message}</p>}
              </div>

              <div>
                <Label htmlFor="appOwner">Application Owner *</Label>
                <Input {...register('appOwner', { required: 'Owner is required' })} placeholder="e.g. John Doe" />
                {errors.appOwner && <p className="text-sm text-destructive">{errors.appOwner.message}</p>}
              </div>

              <div>
                <Label htmlFor="appSPOC">Application SPOC</Label>
                <Input {...register('appSPOC')} placeholder="e.g. Jane Smith" />
              </div>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Input {...register('remarks')} placeholder="Optional remarks" />
              </div>
            </div>

            {/* File Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Existing .crt File *</Label>
                <FileUpload
                  accept=".crt"
                  value={existingCrt}
                  onChange={(file) => setValue('existingCrt', file as File | null)}
                  placeholder="Upload .crt"
                  required
                />
                {!existingCrt && <p className="text-sm text-destructive">Required</p>}
              </div>

              <div>
                <Label>Existing .key File *</Label>
                <FileUpload
                  accept=".key"
                  value={existingKey}
                  onChange={(file) => setValue('existingKey', file as File | null)}
                  placeholder="Upload .key"
                  required
                />
                {!existingKey && <p className="text-sm text-destructive">Required</p>}
              </div>
            </div>

            <Button type="submit" className="w-full bg-gradient-primary hover:bg-primary-glow">
              Import Certificate
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrtKeyUploader;