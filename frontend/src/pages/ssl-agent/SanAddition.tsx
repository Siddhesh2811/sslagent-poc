import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileCheck, Search, Plus, Trash2, ShieldCheck, Download } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { useToast } from '@/hooks/use-toast';

interface AnalyzeResponse {
    dns: string;
    san: string[];
    isKeyAvailable: boolean;
    dbRecord: any;
}

const SanAddition = () => {
    const { toast } = useToast();
    const [crtFile, setCrtFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalyzeResponse | null>(null);

    // SAN Management State
    const [sanList, setSanList] = useState<string[]>([]);
    const [newSan, setNewSan] = useState('');
    const [updating, setUpdating] = useState(false);

    const handleAnalyze = async () => {
        if (!crtFile) {
            toast({ title: "Error", description: "Please upload a CRT file first.", variant: "destructive" });
            return;
        }

        setAnalyzing(true);
        const formData = new FormData();
        formData.append('existingCrt', crtFile);

        try {
            const res = await fetch('http://localhost:5000/api/certificates/analyze', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Could not analyze certificate");
            }

            setAnalysisData(data);
            setSanList(data.san || []);

            toast({ title: "Analysis Complete", description: `Found matching key for ${data.dns}` });
        } catch (err: any) {
            console.error(err);
            toast({
                title: "Analysis Failed",
                description: err.message,
                variant: "destructive"
            });
            setAnalysisData(null);
        } finally {
            setAnalyzing(false);
        }
    };

    const addSan = () => {
        if (!newSan.trim()) return;
        if (sanList.includes(newSan.trim())) {
            toast({ title: "Duplicate", description: "SAN already exists", variant: "destructive" });
            return;
        }
        setSanList([...sanList, newSan.trim()]);
        setNewSan('');
    };

    const removeSan = (sanToRemove: string) => {
        setSanList(sanList.filter(s => s !== sanToRemove));
    };

    const handleUpdate = async () => {
        if (!analysisData) return;

        setUpdating(true);
        try {
            const res = await fetch('http://localhost:5000/api/certificates/update-san', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dns: analysisData.dns,
                    sanList: sanList
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Update failed");
            }

            toast({
                title: "Success",
                description: "SANs updated and CSR/CNF regenerated successfully."
            });

            // Auto-download the new ZIP? Or give a link?
            // Since backend only updates GridFS, we need to fetch the download URL.
            // Re-using the download endpoint: /api/certificates/download-zip/:dns

            window.open(`http://localhost:5000/api/certificates/download-zip/${analysisData.dns}`, '_blank');

        } catch (err: any) {
            toast({
                title: "Update Failed",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">SAN Management</h1>
                <p className="text-muted-foreground">Add or remove SANs for existing certificates using the stored Private Key.</p>
            </div>

            {/* Step 1: Upload & Analyze */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" /> Analyze Certificate
                    </CardTitle>
                    <CardDescription>Upload an existing CRT to check if we have the matching Private Key.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Upload .crt File</Label>
                        <FileUpload
                            accept=".crt"
                            onChange={(file) => setCrtFile(file as File)} // casting as FileUpload can return File|File[]|null
                            value={crtFile}
                        />
                    </div>
                    <Button
                        onClick={handleAnalyze}
                        disabled={!crtFile || analyzing}
                        className="w-full"
                    >
                        {analyzing ? "Analyzing..." : "Analyze Certificate"}
                    </Button>
                </CardContent>
            </Card>

            {/* Step 2: Manage SANs */}
            {analysisData && (
                <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-green-500" />
                            Manage SANs for {analysisData.dns}
                        </CardTitle>
                        <CardDescription>
                            {analysisData.isKeyAvailable
                                ? "Private Key found. You can modify SANs and regenerate the CSR."
                                : <span className="text-red-500 font-bold">Private Key NOT found. Cannot proceed.</span>
                            }
                        </CardDescription>
                    </CardHeader>

                    {analysisData.isKeyAvailable && (
                        <CardContent className="space-y-6">

                            {/* SAN Table */}
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Subject Alternative Name (DNS)</TableHead>
                                            <TableHead className="w-[100px]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sanList.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground">No SANs found</TableCell>
                                            </TableRow>
                                        )}
                                        {sanList.map((san) => (
                                            <TableRow key={san}>
                                                <TableCell>{san}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeSan(san)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Add New SAN */}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1 space-y-2">
                                    <Label>Add New SAN</Label>
                                    <Input
                                        placeholder="e.g. sub.example.com"
                                        value={newSan}
                                        onChange={(e) => setNewSan(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addSan()}
                                    />
                                </div>
                                <Button onClick={addSan} variant="secondary">
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                </Button>
                            </div>

                            <div className="pt-4 border-t">
                                <Button
                                    onClick={handleUpdate}
                                    disabled={updating}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    {updating ? "Regenerating..." : "Update SANs & Regenerate CSR"}
                                </Button>
                            </div>

                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
};

export default SanAddition;
