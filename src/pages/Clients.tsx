import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal,
  Edit,
  Trash2,
  Share2,
  Download,
  Eye,
  Save,
  X,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { 
  getClients, 
  updateClient, 
  deleteClient, 
  createClient,
  ClientRecord 
} from "@/integrations/firebase/clientService";
import { useAuth } from "@/contexts/AuthContext";

interface Client extends ClientRecord {
  isEditing?: boolean;
}

const Clients = () => {
  const { currentUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Fetch clients from Firestore
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const clientsData = await getClients(currentUser?.uid);
        setClients(clientsData.map(client => ({ ...client, isEditing: false })));
      } catch (error) {
        console.error('Error fetching clients:', error);
        toast.error('Failed to load clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [currentUser]);

  const getStatusColor = (status: string) => {
    // All statuses use the same gray color scheme for monochromatic theme
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const handleEditClient = (clientId: string) => {
    setClients(prev => prev.map(client => 
      client.id === clientId 
        ? { ...client, isEditing: true }
        : client
    ));
    const clientToEdit = clients.find(c => c.id === clientId);
    if (clientToEdit) {
      setEditingClient({ ...clientToEdit });
    }
  };

  const handleSaveClient = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !editingClient) return;

    try {
      setLoading(true);
      await updateClient(clientId, editingClient);
      
      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId 
          ? { ...editingClient, id: clientId, isEditing: false }
          : c
      ));
      
      setEditingClient(null);
      toast.success('Client updated successfully');
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = (clientId: string) => {
    setClients(prev => prev.map(client => 
      client.id === clientId 
        ? { ...client, isEditing: false }
        : client
    ));
    setEditingClient(null);
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to delete ${clientName}?`)) {
      try {
        setLoading(true);
        await deleteClient(clientId);
        setClients(prev => prev.filter(client => client.id !== clientId));
        toast.success(`${clientName} deleted successfully`);
      } catch (error) {
        console.error('Error deleting client:', error);
        toast.error('Failed to delete client');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddNewClient = async () => {
    const newClientData = {
      clientName: 'New Client',
      work: 'New Project',
      status: 'Not started' as const,
      prePayment: 0,
      paidPayment: 0,
      finalPayment: 0,
      duration: '1 week',
      userId: currentUser?.uid
    };

    try {
      setLoading(true);
      const newClientId = await createClient(newClientData);
      const newClient = { ...newClientData, id: newClientId, isEditing: true };
      setClients(prev => [newClient, ...prev]);
      setEditingClient(newClient);
      toast.success('New client added');
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('Failed to add client');
    } finally {
      setLoading(false);
    }
  };

  const handleShareClient = (client: Client) => {
    const shareData = {
      name: client.clientName,
      work: client.work,
      status: client.status,
      amount: client.finalPayment
    };
    
    if (navigator.share) {
      navigator.share({
        title: `Client: ${client.clientName}`,
        text: `Work: ${client.work}, Status: ${client.status}, Amount: ₹${client.finalPayment.toLocaleString('en-IN')}`,
      });
    } else {
      navigator.clipboard.writeText(JSON.stringify(shareData, null, 2));
      toast.success('Client data copied to clipboard');
    }
  };

  const handleShareAll = () => {
    const allClientsData = {
      totalClients: clients.length,
      completedClients: clients.filter(c => c.status === 'Done').length,
      totalRevenue: clients.reduce((sum, client) => sum + client.finalPayment, 0),
      paidAmount: clients.reduce((sum, client) => sum + client.paidPayment, 0),
      clients: clients.map(({ id, clientName, work, status, finalPayment }) => ({
        id, clientName, work, status, finalPayment
      }))
    };
    
    navigator.clipboard.writeText(JSON.stringify(allClientsData, null, 2));
    toast.success('All client data copied to clipboard');
  };

  const handleCellEdit = (field: keyof Client, value: string | number) => {
    if (!editingClient) return;
    
    setEditingClient(prev => {
      if (!prev) return null;
      
      // Convert string values to numbers for payment fields
      if (field === 'prePayment' || field === 'paidPayment' || field === 'finalPayment') {
        const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        return { ...prev, [field]: numValue };
      }
      
      return { ...prev, [field]: value };
    });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.work.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPrePayment = clients.reduce((sum, client) => sum + client.prePayment, 0);
  const totalPaidPayment = clients.reduce((sum, client) => sum + client.paidPayment, 0);
  const totalFinalPayment = clients.reduce((sum, client) => sum + client.finalPayment, 0);
  const completedClients = clients.filter(client => client.status === "Done").length;

  if (loading && clients.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#14181f]">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Personal Client Management</h2>
          
          <Button
            onClick={handleAddNewClient}
            size="sm"
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium shadow-lg transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Filter Bar */}
        <div className="bg-[#14181f] rounded-xl border border-slate-700 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[#14181f] border-slate-600 text-white placeholder-gray-400 focus:border-gray-500 focus:ring-gray-500/20"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white rounded-lg px-3 py-2 focus:border-gray-500 focus:ring-gray-500/20"
              >
                <option value="all">All Status</option>
                <option value="Done">Done</option>
                <option value="Not paid yet">Not paid yet</option>
                <option value="In progress">In progress</option>
                <option value="Not started">Not started</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-[#14181f] rounded-xl border border-slate-700 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700">Client Name</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700">Work</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700">Status</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700 text-right"># pre pay</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700 text-right">Post pay</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700 text-right"># Final payment</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700">Duration</TableHead>
                <TableHead className="text-gray-300 font-semibold border-b border-slate-700 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50">
                  <TableCell>
                    {client.isEditing ? (
                      <Input
                        value={editingClient?.clientName || ''}
                        onChange={(e) => handleCellEdit('clientName', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8"
                      />
                    ) : (
                      <span className="text-white font-medium">{client.clientName}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.isEditing ? (
                      <Input
                        value={editingClient?.work || ''}
                        onChange={(e) => handleCellEdit('work', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8"
                      />
                    ) : (
                      <span className="text-gray-300">{client.work}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.isEditing ? (
                      <select
                        value={editingClient?.status || 'Not started'}
                        onChange={(e) => handleCellEdit('status', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white rounded px-2 py-1 h-8"
                      >
                        <option value="Done">Done</option>
                        <option value="Not paid yet">Not paid yet</option>
                        <option value="In progress">In progress</option>
                        <option value="Not started">Not started</option>
                      </select>
                    ) : (
                      <Badge className={`${getStatusColor(client.status)} font-medium`}>
                        {client.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.isEditing ? (
                      <Input
                        type="number"
                        value={editingClient?.prePayment || 0}
                        onChange={(e) => handleCellEdit('prePayment', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8 w-24 text-right"
                      />
                    ) : (
                      <span className="text-gray-300 font-mono">₹{client.prePayment.toLocaleString('en-IN')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.isEditing ? (
                      <Input
                        type="number"
                        value={editingClient?.paidPayment || 0}
                        onChange={(e) => handleCellEdit('paidPayment', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8 w-24 text-right"
                      />
                    ) : (
                      <span className="text-gray-300 font-mono">₹{client.paidPayment.toLocaleString('en-IN')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {client.isEditing ? (
                      <Input
                        type="number"
                        value={editingClient?.finalPayment || 0}
                        onChange={(e) => handleCellEdit('finalPayment', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8 w-24 text-right"
                      />
                    ) : (
                      <span className="text-gray-300 font-mono">₹{client.finalPayment.toLocaleString('en-IN')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.isEditing ? (
                      <Input
                        value={editingClient?.duration || ''}
                        onChange={(e) => handleCellEdit('duration', e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white h-8"
                      />
                    ) : (
                      <span className="text-gray-300">{client.duration}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      {client.isEditing ? (
                        <>
                          <Button
                            onClick={() => handleSaveClient(client.id!)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleCancelEdit(client.id!)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => handleEditClient(client.id!)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
                            title="Edit client"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteClient(client.id!, client.clientName)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-400 hover:bg-slate-700 h-8 w-8 p-0"
                            title="Delete client"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleShareClient(client)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white hover:bg-slate-700 h-8 w-8 p-0"
                            title="Share client"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Summary Section */}
        <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">COUNT</p>
              <p className="text-2xl font-bold text-white">{clients.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">SUM</p>
              <p className="text-2xl font-bold text-white">₹{totalFinalPayment.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clients;
