import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  Home, 
  Shield, 
  PlusCircle, 
  RefreshCw, 
  Package, 
  Upload,
  Activity
} from 'lucide-react';

const navigationItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Activity', url: '/activity', icon: Activity },
];

const sslAgentItems = [
  { title: 'New Certificate', url: '/ssl-agent/new', icon: PlusCircle },
  { title: 'Renew Certificate', url: '/ssl-agent/renew', icon: RefreshCw },
  { title: 'PFX Generator', url: '/ssl-agent/pfx', icon: Package },
  { title: 'CRT & KEY Uploader', url: '/ssl-agent/upload', icon: Upload },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  const getNavClass = (isActive: boolean) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-primary font-medium" 
      : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        {/* Logo/Brand Section */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-sidebar-primary" />
            {!isCollapsed && (
              <div>
                <h2 className="font-bold text-sidebar-foreground">SSL Manager</h2>
                <p className="text-xs text-muted-foreground">Certificate Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass(isActive(item.url))}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SSL Agent Section */}
        <SidebarGroup>
          <SidebarGroupLabel>SSL Agent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sslAgentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass(isActive(item.url))}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}