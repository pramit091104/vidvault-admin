import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// Mock data
const mockCodes = [
  {
    id: "1",
    code: "ABC123XYZ",
    videoTitle: "Client Draft v1",
    clientName: "John Doe",
    expiry: "2024-12-31",
    status: "active",
  },
  {
    id: "2",
    code: "DEF456UVW",
    videoTitle: "Project Showcase",
    clientName: "Jane Smith",
    expiry: "2024-06-30",
    status: "expired",
  },
];

const CodesSection = () => {
  const [clientName, setClientName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const generateCode = () => {
    if (!clientName || !expiryDate) {
      toast.error("Please enter client name and expiry date");
      return;
    }

    // TODO: Implement code generation and Firebase storage
    const code = Math.random().toString(36).substring(2, 11).toUpperCase();
    toast.success(`Code generated: ${code}`);
    setClientName("");
    setExpiryDate("");
  };

  const handleDelete = (id: string) => {
    // TODO: Implement delete functionality
    console.log("Delete code:", id);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Generate Security Code
          </CardTitle>
          <CardDescription>
            Create a unique access code for a client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
          <Button
            onClick={generateCode}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <Key className="mr-2 h-4 w-4" />
            Generate Code
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Active Security Codes
          </CardTitle>
          <CardDescription>
            Manage all generated access codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Code</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCodes.map((code) => (
                  <TableRow key={code.id} className="hover:bg-secondary/30">
                    <TableCell className="font-mono font-medium">{code.code}</TableCell>
                    <TableCell>{code.videoTitle}</TableCell>
                    <TableCell>{code.clientName}</TableCell>
                    <TableCell>{code.expiry}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          code.status === "active"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {code.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        onClick={() => handleDelete(code.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CodesSection;
