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
  Edit,
  Trash2,
  Share2,
  Save,
  X,
  Crown,
  AlertCircle,
  Loader2
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
import { validateClientCreation } from "@/services/backendApiService";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";
import { Progress } from "@/components/ui/progress";

interface Client extends ClientRecord {
  isEditing?: boolean;
}

const Clients = () => {
  const { currentUser, subscription, setSubscription } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
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
        await deleteClient(clientId);
        setClients(prev => prev.filter(client => client.id !== clientId));
        toast.success(`${clientName} deleted successfully`);
      } catch (error) {
        console.error('Error deleting client:', error);
        toast.error('Failed to delete client');
      }
    }
  };

  const handleAddNewClient = async () => {
    const now = Date.now();
    
    // Prevent multiple rapid clicks (debounce with 1 second)
    if (isCreatingClient || (now - lastClickTime < 1000)) {
      return;
    }

    setLastClickTime(now);
    setIsCreatingClient(true);

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
      // First validate and increment count via backend API
      const user = currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();
      
      const response = await fetch('/api/clients/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          clientName: newClientData.clientName,
          work: newClientData.work,
          status: newClientData.status,
          duration: newClientData.duration
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to create client' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const backendResult = await response.json();

      // If backend validation and count increment succeed, create in Firestore
      const newClientId = await createClient(newClientData);
      const newClient = { ...newClientData, id: newClientId, isEditing: true };
      setClients(prev => [newClient, ...prev]);
      setEditingClient(newClient);
      
      // Update local subscription state with backend result
      if (backendResult.subscription) {
        setSubscription(prev => ({
          ...prev,
          clientsUsed: backendResult.subscription.clientsUsed
        }));
      }
      
      toast.success('New client added');
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add client');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleShareClient = (client: Client) => {
    const shareData = {
      name: client.clientName,
      work: client.work,
      status: client.status,
      duration: client.duration
    };
    
    if (navigator.share) {
      navigator.share({
        title: `Client: ${client.clientName}`,
        text: `Work: ${client.work}, Status: ${client.status}, Duration: ${client.duration}`,
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
      clients: clients.map(({ id, clientName, work, status, duration }) => ({
        id, clientName, work, status, duration
      }))
    };
    
    navigator.clipboard.writeText(JSON.stringify(allClientsData, null, 2));
    toast.success('All client data copied to clipboard');
  };

  const handleCellEdit = (field: string, value: string | number) => {
    setEditingClient(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.work.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          
          <div className="flex items-center gap-3">
            {subscription.tier === 'free' && clients.length >= subscription.maxClients && (
              <PremiumPaymentModal>
                <Button
                  size="sm"
                  className="bg-purple-500 hover:bg-purple-600 text-white font-medium shadow-lg transition-all duration-300"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              </PremiumPaymentModal>
            )}
            
            <Button
              onClick={handleAddNewClient}
              size="sm"
              disabled={clients.length >= subscription.maxClients || isCreatingClient}
              className="bg-gray-700 hover:bg-gray-600 text-white font-medium shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingClient ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {clients.length >= subscription.maxClients ? 'Limit Reached' : 'New'}
                </>
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Client Usage Status */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Client Usage</span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={subscription.tier === 'premium' ? 'default' : 'secondary'} 
                className={`${subscription.tier === 'premium' ? 'bg-purple-500 hover:bg-purple-600' : ''}`}
              >
                {subscription.tier === 'premium' && <Crown className="h-3 w-3 mr-1" />}
                {subscription.tier.toUpperCase()}
              </Badge>
              {subscription.tier === 'free' && (
                <PremiumPaymentModal>
                  <Button 
                    size="sm" 
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Upgrade
                  </Button>
                </PremiumPaymentModal>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Progress 
              value={(clients.length / subscription.maxClients) * 100} 
              className="flex-1 h-2" 
            />
            <span className="text-sm text-muted-foreground">
              {clients.length}/{subscription.maxClients}
            </span>
          </div>
          {clients.length >= subscription.maxClients && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Client limit reached. {subscription.tier === 'free' ? 'Upgrade to add more clients.' : 'Limit resets monthly.'}</span>
            </div>
          )}
        </div>
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
              <p className="text-gray-400 text-sm mb-1">TOTAL CLIENTS</p>
              <p className="text-2xl font-bold text-white">{clients.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">COMPLETED</p>
              <p className="text-2xl font-bold text-white">{completedClients}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clients;
