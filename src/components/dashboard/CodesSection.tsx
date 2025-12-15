import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2, Copy, Shield, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getSecurityCodesByUser, deleteSecurityCode } from "@/integrations/firebase/securityCodeService";
import { VideoSecurityCode } from "@/lib/securityCode";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { format } from "date-fns";

const CodesSection = () => {
  const [clientName, setClientName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [securityCodes, setSecurityCodes] = useState<VideoSecurityCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch security codes when user is authenticated
    const fetchSecurityCodes = async () => {
      if (currentUser) {
        try {
          setLoading(true);
          const codes = await getSecurityCodesByUser(currentUser.uid);
          setSecurityCodes(codes);
        } catch (error: any) {
          console.error('Error fetching security codes:', error);
          toast.error('Failed to fetch security codes');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchSecurityCodes();
  }, [currentUser]);

  // Filter only active security codes
  const activeCodes = securityCodes.filter(code => code.isActive);
  const filteredCodes = activeCodes.filter(code => 
    (code.clientName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (code.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (code.securityCode?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const generateCode = () => {
    if (!clientName) {
      toast.error("Please enter client name");
      return;
    }

    // Note: Security codes are now generated during video upload
    toast.info("Security codes are automatically generated when uploading videos for clients.");
    setClientName("");
    setExpiryDate("");
  };

  const handleDelete = async (clientName: string) => {
    if (!clientName || clientName.trim() === '') {
      toast.error('Invalid client name for deletion');
      return;
    }

    try {
      await deleteSecurityCode(clientName);
      // Refresh the list
      if (currentUser) {
        const codes = await getSecurityCodesByUser(currentUser.uid);
        setSecurityCodes(codes);
      }
      toast.success('Security code deleted successfully');
    } catch (error: any) {
      console.error('Error deleting security code:', error);
      toast.error(error.message || 'Failed to delete security code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Security code copied to clipboard!');
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM dd, yyyy');
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Active Security Codes ({filteredCodes.length})
          </CardTitle>
          <CardDescription>
            Manage all generated access codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search by client, video title, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background/50 max-w-sm"
            />
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading security codes...</span>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No security codes found matching your search.' : 'No security codes yet. Upload videos to generate codes.'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Security Code</TableHead>
                    <TableHead>Video Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Access Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow key={code.videoId} className="hover:bg-secondary/30">
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {code.securityCode}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => copyCode(code.securityCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={code.title}>
                        {code.title}
                      </TableCell>
                      <TableCell>{code.clientName}</TableCell>
                      <TableCell>{formatDate(code.uploadedAt)}</TableCell>
                      <TableCell>{code.accessCount}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            code.isActive
                              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                              : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                          }
                        >
                          {code.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => handleDelete(code.clientName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CodesSection;
