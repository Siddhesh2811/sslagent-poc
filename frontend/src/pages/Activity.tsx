import React, { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Download,
  Activity as ActivityIcon,
  Clock,
  User,
  Info,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type ActivityRow = {
  id: string;
  type: string;
  dns: string;
  sanList?: string[]; // Added
  appName: string;
  owner: string;
  spoc?: string;
  ca: string;
  createdAt: string;
  createdBy?: string;
  status: string;
  csr_md5?: string;
  key_md5?: string;
  remarks?: string;
};

type ActivityLog = {
  id: number;
  dns: string;
  action_type: string;
  performed_by: string;
  timestamp: string;
  details: any;
};

const Activity: React.FC = () => {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  // History State
  const [historyLogs, setHistoryLogs] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCert, setSelectedCert] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const viewHistory = async (dns: string) => {
    setSelectedCert(dns);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/certificates/activity/${dns}`
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryLogs(data);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(
          "http://localhost:5000/api/certificates/activity"
        );
        if (!res.ok) throw new Error("Failed to fetch activity");
        const data = await res.json();
        setActivities(data);
      } catch (err) {
        console.error("Error loading activity:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let filtered = activities.filter((activity) => {
      const matchesSearch =
        activity.dns?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.appName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.id?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === "all" || activity.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || activity.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "dns":
          return a.dns.localeCompare(b.dns);
        case "owner":
          return a.owner.localeCompare(b.owner);
        case "type":
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  }, [activities, searchTerm, typeFilter, statusFilter, sortBy]);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-success text-success-foreground">
            Completed
          </Badge>
        );
      case "Processing":
        return (
          <Badge className="bg-warning text-warning-foreground">
            Processing
          </Badge>
        );
      case "Pending":
        return <Badge variant="outline">Pending</Badge>;
      case "Failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      New: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100",
      Renew: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
      "SAN Update": "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
      PFX: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
      Upload: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100",
    };

    return (
      <Badge
        variant="outline"
        className={`${styles[type] || "bg-gray-100 text-gray-800 border-gray-200"} border`}
      >
        {type}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Type",
      "DNS",
      "App Name",
      "Owner",
      "SPOC",
      "CA",
      "Created At",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedData.map((row) =>
        [
          row.id,
          row.type,
          row.dns,
          row.appName,
          row.owner,
          row.spoc || "",
          row.ca,
          formatDate(row.createdAt),
          row.status,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ssl_activities.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-8 text-center">Loading activity...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <ActivityIcon className="h-8 w-8" />
          All Certificates
        </h1>
        <p className="text-muted-foreground">
          View and manage all certificates in the system
        </p>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
          <CardDescription>
            Filter and search through certificate activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by DNS, App Name, Owner, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Renew">Renew</SelectItem>
                  <SelectItem value="PFX">PFX</SelectItem>
                  <SelectItem value="Upload">Upload</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="dns">DNS</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>
            Certificate Activities ({filteredAndSortedData.length} records)
          </CardTitle>
          <CardDescription>
            Detailed list of all certificate operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>DNS</TableHead>
                  <TableHead>SAN List</TableHead>
                  <TableHead>App Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7} // Adjusted colspan to 7
                      className="text-center py-8 text-muted-foreground"
                    >
                      No activities found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => viewHistory(activity.dns)}
                    >
                      <TableCell className="font-mono text-sm">
                        {activity.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {activity.dns}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {activity.sanList?.slice(0, 2).map((san: string) => (
                            <Badge key={san} variant="secondary" className="text-[10px] px-1 h-5">
                              {san}
                            </Badge>
                          ))}
                          {activity.sanList && activity.sanList.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1 h-5">
                              +{activity.sanList.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{activity.appName}</TableCell>
                      <TableCell>{activity.owner}</TableCell>
                      <TableCell>{activity.ca}</TableCell>

                      {/* ACTIONS: Download CSR */}
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `http://localhost:5000/api/certificates/download-zip/${activity.dns}`
                            );
                          }}
                        ><Download className="h-4 w-4 mr-2" />
                          ZIP
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* History Sheet */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Activity History</SheetTitle>
            <SheetDescription>
              Timeline for {selectedCert}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 h-[calc(100vh-150px)]">
            {historyLoading ? (
              <div className="text-center py-8">Loading history...</div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="space-y-8">
                  {historyLogs.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                      No history found for this certificate.
                    </div>
                  ) : (
                    historyLogs.map((log) => (
                      <div key={log.id} className="relative flex gap-4 pb-4">
                        {/* Timeline line */}
                        <div className="absolute left-[19px] top-8 bottom-0 w-px bg-border" />

                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                          <ActivityIcon className="h-5 w-5 text-primary" />
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{log.action_type}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>

                          <div className="rounded-lg border p-3 text-sm bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-3 w-3" />
                              <span className="font-mono text-xs">{log.performed_by}</span>
                            </div>

                            {log.details && (
                              <div className="text-xs text-muted-foreground mt-2">
                                <pre className="whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                                  {typeof log.details === 'string'
                                    ? log.details
                                    : JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Activity;
