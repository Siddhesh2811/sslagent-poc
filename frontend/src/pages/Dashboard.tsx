import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const quickStats = [
    {
      title: 'Active Certificates',
      value: '24',
      description: 'Currently valid certificates',
      icon: Shield,
      color: 'text-success',
    },
    {
      title: 'Expiring Soon',
      value: '3',
      description: 'Certificates expiring in 30 days',
      icon: AlertTriangle,
      color: 'text-warning',
    },
    {
      title: 'Recent Requests',
      value: '12',
      description: 'New requests this month',
      icon: Clock,
      color: 'text-primary',
    },
    {
      title: 'Completed',
      value: '156',
      description: 'Total certificates issued',
      icon: CheckCircle,
      color: 'text-success',
    },
  ];

  const recentActivity = [
    { type: 'New', dns: 'api.example.com', status: 'Pending', date: '2 hours ago' },
    { type: 'Renew', dns: 'www.company.com', status: 'Completed', date: '1 day ago' },
    { type: 'PFX', dns: 'secure.portal.net', status: 'Processing', date: '2 days ago' },
    { type: 'Upload', dns: 'internal.tools.org', status: 'Completed', date: '3 days ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your SSL Certificate Management portal
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <Card key={index} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Guide */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              User Guide
            </CardTitle>
            <CardDescription>
              Learn how to manage your SSL certificates effectively
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none text-foreground">
              <h4 className="font-semibold mb-2">Getting Started</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Welcome to the SSL Certificate Management portal. This system helps you 
                manage the lifecycle of your SSL certificates from request to deployment.
              </p>
              
              <h4 className="font-semibold mb-2">Certificate Operations</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>New Certificate:</strong> Request a new SSL certificate for your domain</li>
                <li><strong>Renew Certificate:</strong> Renew an existing certificate before expiration</li>
                <li><strong>PFX Generator:</strong> Convert certificates to PFX format for Windows servers</li>
                <li><strong>Upload CRT & KEY:</strong> Upload existing certificate files for management</li>
              </ul>

              <h4 className="font-semibold mb-2 mt-4">Best Practices</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Renew certificates at least 30 days before expiration</li>
                <li>Use descriptive names for applications and owners</li>
                <li>Keep certificate files secure and backed up</li>
                <li>Monitor the activity log for certificate status updates</li>
              </ul>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => navigate('/ssl-agent/new')}
                className="bg-gradient-primary hover:bg-primary-glow"
              >
                Request New Certificate
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/activity')}
              >
                View Activity
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest certificate operations and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {activity.type}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{activity.dns}</p>
                      <p className="text-xs text-muted-foreground">{activity.date}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      activity.status === 'Completed' ? 'default' :
                      activity.status === 'Processing' ? 'secondary' : 'outline'
                    }
                    className={
                      activity.status === 'Completed' ? 'bg-success text-success-foreground' :
                      activity.status === 'Processing' ? 'bg-warning text-warning-foreground' : ''
                    }
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/activity')}
            >
              View All Activity
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;