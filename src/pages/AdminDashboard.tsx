import { useEffect, useState, useRef } from "react";
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
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ email: string; password: string }[]>([]);
  const [importErrors, setImportErrors] = useState<{ email: string; error: string }[]>([]);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDeleteUser = async (userId: string, email: string) => {
    try {
      setDeletingUser(userId);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) throw error;

      toast.success(`User ${email} deleted successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
    } finally {
      setDeletingUser(null);
    }
  };

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row");
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: any = {};
        
        headers.forEach((header, index) => {
          if (header === 'semester') {
            user[header] = values[index] ? parseInt(values[index]) : undefined;
          } else {
            user[header] = values[index] || undefined;
          }
        });
        
        return user;
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('bulk-create-users', {
        body: { users },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) throw error;

      const results = data as { success: { email: string; password: string }[]; failed: { email: string; error: string }[] };

      if (results.success.length > 0) {
        toast.success(`Successfully imported ${results.success.length} users`);
        setImportResults(results.success);
      }

      if (results.failed.length > 0) {
        toast.error(`Failed to import ${results.failed.length} users. See details below.`);
        setImportErrors(results.failed);
      }

      fetchUsers();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      toast.error("Import failed: " + error.message);
      console.error("Bulk import error:", error);
    } finally {
      setImporting(false);
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
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkImport(true)} variant="secondary">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </Button>
            <Button onClick={signOut} variant="outline">
              Sign Out
            </Button>
          </div>
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
                  <TableHead></TableHead>
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
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deletingUser === userData.id}
                          >
                            {deletingUser === userData.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {userData.email}? This action cannot be undone and will permanently delete the user account and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(userData.id, userData.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showBulkImport} onOpenChange={(open) => {
          setShowBulkImport(open);
          if (!open) {
            setImportResults([]);
            setImportErrors([]);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Import Users</DialogTitle>
              <DialogDescription>
                Upload a CSV file to create multiple users at once
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {importResults.length === 0 && importErrors.length === 0 ? (
                <>
                  <Alert>
                    <AlertDescription>
                      <strong>CSV Format:</strong> email,full_name,role,roll_number,department,semester
                      <br />
                      <strong>Roles:</strong> admin, teacher, student
                      <br />
                      <strong>Note:</strong> roll_number is required for students. department and semester are optional.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Select CSV File</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleBulkImport}
                      disabled={importing}
                    />
                  </div>
                  {importing && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Importing users...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {importResults.length > 0 && (
                    <>
                      <Alert>
                        <AlertDescription>
                          <strong>Important:</strong> Save these credentials now. They won't be shown again.
                        </AlertDescription>
                      </Alert>
                      <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                        <h3 className="font-semibold mb-2">Successfully Created Users</h3>
                        {importResults.map((result, index) => (
                          <div key={index} className="p-3 bg-muted rounded space-y-1 text-sm">
                            <div><strong>Email:</strong> {result.email}</div>
                            <div className="flex items-center gap-2">
                              <strong>Password:</strong> 
                              <code className="bg-background px-2 py-1 rounded">{result.password}</code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(result.password);
                                  toast.success("Password copied!");
                                }}
                              >
                                Copy
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={() => {
                          const text = importResults.map(r => `Email: ${r.email}\nPassword: ${r.password}`).join('\n\n');
                          navigator.clipboard.writeText(text);
                          toast.success("All credentials copied!");
                        }}
                        className="w-full"
                      >
                        Copy All Credentials
                      </Button>
                    </>
                  )}
                  
                  {importErrors.length > 0 && (
                    <>
                      <Alert variant="destructive">
                        <AlertDescription>
                          <strong>Failed to Import {importErrors.length} Users</strong>
                        </AlertDescription>
                      </Alert>
                      <div className="border border-destructive rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                        <h3 className="font-semibold mb-2 text-destructive">Import Errors</h3>
                        {importErrors.map((error, index) => (
                          <div key={index} className="p-3 bg-destructive/10 rounded space-y-1 text-sm">
                            <div><strong>Email:</strong> {error.email}</div>
                            <div className="text-destructive"><strong>Error:</strong> {error.error}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;
