import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "teacher" | "student" | null;
}

const AdminDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "teacher" | "student">("student");

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "admin")) {
      navigate("/");
    }
  }, [user, userRole, navigate, authLoading]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersData: UserData[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRole?.role as "admin" | "teacher" | "student" | null,
        };
      });

      setUsers(usersData);
    } catch (error: any) {
      toast.error("Failed to fetch users: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && userRole === "admin") {
      fetchUsers();
    }
  }, [user, userRole]);

  const handleUpdateProfile = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editFullName })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to update profile: " + error.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: "admin" | "teacher" | "student") => {
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast.success("Role updated successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || userRole !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Manage users, roles, and profiles</p>
          </div>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all users in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userData) => (
                  <TableRow key={userData.id}>
                    <TableCell>{userData.email}</TableCell>
                    <TableCell>{userData.full_name}</TableCell>
                    <TableCell>
                      <Select
                        value={userData.role || "none"}
                        onValueChange={(value) => {
                          if (value !== "none") {
                            handleUpdateRole(userData.id, value as "admin" | "teacher" | "student");
                          }
                        }}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Role</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingUser(userData);
                              setEditFullName(userData.full_name);
                              setEditRole(userData.role || "student");
                            }}
                          >
                            Edit Profile
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit User Profile</DialogTitle>
                            <DialogDescription>
                              Update user information
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="email">Email</Label>
                              <Input id="email" value={userData.email} disabled />
                            </div>
                            <div>
                              <Label htmlFor="fullName">Full Name</Label>
                              <Input
                                id="fullName"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleUpdateProfile}>Save Changes</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
