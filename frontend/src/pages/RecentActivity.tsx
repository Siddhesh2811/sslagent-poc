import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Search,
    Activity as ActivityIcon,
    User,
    Clock,
} from "lucide-react";

type ActivityLog = {
    id: number;
    dns: string;
    action_type: string;
    performed_by: string;
    timestamp: string;
    details: any;
};

const RecentActivity = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch("http://localhost:5000/api/certificates/recent-activity");
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch (err) {
                console.error("Failed to fetch recent activity", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateString;
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log =>
            log.dns.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.performed_by.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [logs, searchTerm]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-8 w-8" />
                    Recent Activity
                </h1>
                <p className="text-muted-foreground">
                    Global feed of all certificate operations across the system
                </p>
            </div>

            <Card className="shadow-card">
                <CardHeader>
                    <CardTitle>Activity Feed</CardTitle>
                    <CardDescription>Latest actions performed by users</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search activity..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>DNS</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Performed By</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No recent activity found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                                                {formatDate(log.timestamp)}
                                            </TableCell>
                                            <TableCell className="font-medium">{log.dns}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${log.action_type === 'CSR Generated' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                        log.action_type === 'Renew' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                            log.action_type === 'SAN Updated' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                                log.action_type === 'PFX Generated' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                    log.action_type === 'Imported' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                                        'bg-gray-100 text-gray-800 border-gray-200'
                                                    }`}>
                                                    {log.action_type}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs">{log.performed_by}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.details && (
                                                    <div className="max-w-[300px] truncate">
                                                        {JSON.stringify(log.details)}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RecentActivity;
