import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, ChevronDown, Edit, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProductProfile } from "@shared/schema";

interface ProfileField {
  key: string;
  value: string;
}

export default function ProfileManager({ 
  selectedProfileId, 
  onProfileSelect 
}: { 
  selectedProfileId: string | null;
  onProfileSelect: (profileId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProductProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileFields, setProfileFields] = useState<ProfileField[]>([
    { key: "", value: "" }
  ]);
  const { toast } = useToast();

  // Fetch all profiles
  const { data: profiles = [], isLoading } = useQuery<ProductProfile[]>({
    queryKey: ["/api/product-profiles"],
  });

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: { name: string; fields: Record<string, string> }) =>
      apiRequest("/api/product-profiles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-profiles"] });
      toast({ title: "Profile created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create profile", variant: "destructive" });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; fields: Record<string, string> } }) =>
      apiRequest(`/api/product-profiles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-profiles"] });
      toast({ title: "Profile updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/product-profiles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-profiles"] });
      toast({ title: "Profile deleted successfully" });
      if (selectedProfileId === deleteProfileMutation.variables) {
        onProfileSelect(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete profile", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setProfileName("");
    setProfileFields([{ key: "", value: "" }]);
    setEditingProfile(null);
  };

  const handleOpenDialog = (profile?: ProductProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileName(profile.name);
      const fields = profile.fields as Record<string, string>;
      setProfileFields(
        Object.entries(fields).map(([key, value]) => ({ key, value }))
      );
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleAddField = () => {
    setProfileFields([...profileFields, { key: "", value: "" }]);
  };

  const handleRemoveField = (index: number) => {
    setProfileFields(profileFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...profileFields];
    updated[index][field] = newValue;
    setProfileFields(updated);
  };

  const handleSave = () => {
    if (!profileName.trim()) {
      toast({ title: "Please enter a profile name", variant: "destructive" });
      return;
    }

    // Convert fields array to object
    const fieldsObject = profileFields
      .filter(f => f.key.trim())
      .reduce((acc, f) => ({ ...acc, [f.key.trim()]: f.value }), {});

    const data = {
      name: profileName,
      fields: fieldsObject,
    };

    if (editingProfile) {
      updateProfileMutation.mutate({ id: editingProfile.id, data });
    } else {
      createProfileMutation.mutate(data);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className="border-b bg-muted/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-toggle-profiles">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  <span className="ml-2 font-semibold">Product Profiles</span>
                </Button>
              </CollapsibleTrigger>
              {selectedProfile && (
                <Badge variant="default" data-testid="badge-selected-profile">
                  Using: {selectedProfile.name}
                </Badge>
              )}
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => handleOpenDialog()} data-testid="button-create-profile">
                  <Plus className="h-4 w-4 mr-2" />
                  New Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-profile-form">
                <DialogHeader>
                  <DialogTitle>{editingProfile ? 'Edit Profile' : 'Create New Profile'}</DialogTitle>
                  <DialogDescription>
                    Save reusable product details like sizes, colors, materials, etc.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Profile Name</Label>
                    <Input
                      id="profile-name"
                      placeholder="e.g., Framed Prints - Standard"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      data-testid="input-profile-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profile Fields</Label>
                    <div className="space-y-2">
                      {profileFields.map((field, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Field name (e.g., Sizes)"
                            value={field.key}
                            onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                            data-testid={`input-field-key-${index}`}
                          />
                          <Input
                            placeholder="Value (e.g., 8x10, 11x14, 16x20)"
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            data-testid={`input-field-value-${index}`}
                          />
                          {profileFields.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveField(index)}
                              data-testid={`button-remove-field-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddField}
                      data-testid="button-add-field"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={createProfileMutation.isPending || updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {editingProfile ? 'Update' : 'Create'} Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-6 pb-4 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading profiles...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No profiles saved yet. Create one to reuse product details across multiple products.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className={`hover-elevate cursor-pointer ${
                      selectedProfileId === profile.id ? 'ring-2 ring-primary' : ''
                    }`}
                    data-testid={`card-profile-${profile.id}`}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold truncate flex-1" title={profile.name}>
                          {profile.name}
                        </CardTitle>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {selectedProfileId === profile.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onProfileSelect(null)}
                              data-testid={`button-deselect-${profile.id}`}
                            >
                              <Check className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleOpenDialog(profile)}
                            data-testid={`button-edit-${profile.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteProfileMutation.mutate(profile.id)}
                            data-testid={`button-delete-${profile.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0" onClick={() => onProfileSelect(profile.id)}>
                      <div className="space-y-0.5">
                        {Object.entries(profile.fields as Record<string, string>).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="text-xs truncate" title={`${key}: ${value}`}>
                            <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                            <span>{value}</span>
                          </div>
                        ))}
                        {Object.keys(profile.fields as Record<string, string>).length > 3 && (
                          <div className="text-xs text-muted-foreground italic">
                            +{Object.keys(profile.fields as Record<string, string>).length - 3} more...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
