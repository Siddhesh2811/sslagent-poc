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
} from "lucide-react";

type ActivityRow = {
  id: string;
  type: string;
  dns: string;
  appName: string;
  owner: string;
  spoc?: string;
  ca: string;
  createdAt: string;
  status: string;
  csr_md5?: string;
  key_md5?: string;
  remarks?: string;
};

const Activity: React.FC = () => {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");

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
    const variants = {
      New: "default",
      Renew: "secondary",
      PFX: "outline",
      Upload: "outline",
    } as const;

    return (
      <Badge variant={variants[type as keyof typeof variants] || "secondary"}>
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
          Activity Log
        </h1>
        <p className="text-muted-foreground">
          Track all SSL certificate operations and their current status
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
                  <TableHead>Type</TableHead>
                  <TableHead>DNS</TableHead>
                  <TableHead>App Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No activities found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((activity) => (
                    <TableRow key={activity.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {activity.id}
                      </TableCell>
                      <TableCell>{getTypeBadge(activity.type)}</TableCell>
                      <TableCell className="font-medium">
                        {activity.dns}
                      </TableCell>
                      <TableCell>{activity.appName}</TableCell>
                      <TableCell>{activity.owner}</TableCell>
                      <TableCell>{activity.ca}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(activity.createdAt)}
                      </TableCell>
                      <TableCell>{getStatusBadge(activity.status)}</TableCell>

                      {/* ACTIONS: Download CSR */}
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `http://localhost:5000/api/certificates/download-zip/${activity.dns}`
                            )
                          }
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
    </div>
  );
};

export default Activity;
