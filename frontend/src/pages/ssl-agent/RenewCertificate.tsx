import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RenewCertificateForm {
  dns: string;
  existingCrt: File | null;
}

const RenewCertificate: React.FC = () => {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<RenewCertificateForm>({
    defaultValues: { existingCrt: null }
  });

  const existingCrt = watch('existingCrt');

  const onSubmit = (data: RenewCertificateForm) => {
    console.log('Renew Certificate Request:', data);
    toast({
      title: "Certificate renewal submitted",
      description: `Renewal request for ${data.dns} has been submitted successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <RefreshCw className="h-8 w-8" />
          Renew Certificate
        </h1>
        <p className="text-muted-foreground">Renew an existing SSL certificate</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Certificate Renewal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="dns">DNS *</Label>
              <Input {...register('dns', { required: 'DNS is required' })} />
              {errors.dns && <p className="text-sm text-destructive">{errors.dns.message}</p>}
            </div>

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

            <Button type="submit" className="bg-gradient-primary hover:bg-primary-glow">
              Submit Renewal Request
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RenewCertificate;