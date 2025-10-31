import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Workflow, 
  LayoutTemplate, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Star,
  Download,
  DollarSign
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'document_template' | 'form_template' | 'pipeline_template';
  type: string;
  pricingModel: 'free' | 'one_time' | 'subscription';
  price: string;
  priceYearly?: string;
  isFeatured: boolean;
  installCount: number;
  rating: string;
  reviewCount: number;
  tags: string[];
  status: string;
  createdAt: Date;
}

export default function MarketplacePublishedPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ['/api/marketplace/items'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest('DELETE', `/api/marketplace/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/items'] });
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      setDeleteItemId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      });
      setDeleteItemId(null);
    },
  });

  const getIcon = (category: string) => {
    switch (category) {
      case 'form_template':
        return <LayoutTemplate className="w-5 h-5" />;
      case 'pipeline_template':
        return <Workflow className="w-5 h-5" />;
      case 'document_template':
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="h-10 w-10 text-white" />
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white">Published Templates</h1>
              </div>
              <p className="text-white/90 text-lg">Manage your marketplace templates published to all organizations</p>
            </div>
            <Button onClick={() => navigate('/admin/marketplace/create')} data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl">

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Loading templates...</p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <LayoutTemplate className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No templates found matching your search' : 'No published templates yet'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/admin/marketplace/create')} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card key={item.id} className="flex flex-col" data-testid={`card-template-${item.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(item.category)}
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                  </div>
                  {item.isFeatured && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="w-3 h-3" />
                      Featured
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2">{item.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {item.category.replace('_', ' ')}
                  </Badge>
                  <Badge 
                    variant={item.status === 'active' ? 'default' : 'secondary'}
                    data-testid={`badge-status-${item.id}`}
                  >
                    {item.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>{item.installCount || 0} installs</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Star className="w-4 h-4" />
                    <span>{item.rating || '0.0'} ({item.reviewCount || 0})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {item.pricingModel === 'free' ? (
                      <span className="text-green-600">Free</span>
                    ) : item.pricingModel === 'subscription' ? (
                      <span>${item.price}/mo</span>
                    ) : (
                      <span>${item.price}</span>
                    )}
                  </span>
                  {item.pricingModel === 'subscription' && item.priceYearly && (
                    <span className="text-sm text-muted-foreground">
                      (${item.priceYearly}/yr)
                    </span>
                  )}
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {item.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{item.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled
                  data-testid={`button-edit-${item.id}`}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteItemId(item.id)}
                  data-testid={`button-delete-${item.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
              All organizations that have installed this template will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItemId && deleteMutation.mutate(deleteItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
