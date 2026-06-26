"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { api, handleApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [isProfileLoading, setIsProfileLoading] = React.useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = React.useState(false);

  const { register: registerProfile, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  const { register: registerPassword, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors }, reset: resetPassword } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileForm) => {
    setIsProfileLoading(true);
    try {
      await api.put("/users/me", data);
      toast.success("Profile updated successfully");
      refresh();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    setIsPasswordLoading(true);
    try {
      await api.put("/users/me/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully");
      resetPassword();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your personal information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar} alt={user?.firstName} />
              <AvatarFallback className="text-lg">
                {user ? getInitials(`${user.firstName} ${user.lastName}`) : "U"}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              <Camera className="mr-2 h-4 w-4" />
              Change Avatar
            </Button>
          </div>

          <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                error={profileErrors.firstName?.message}
                {...registerProfile("firstName")}
              />
              <Input
                label="Last Name"
                error={profileErrors.lastName?.message}
                {...registerProfile("lastName")}
              />
            </div>
            <Input
              label="Email"
              type="email"
              error={profileErrors.email?.message}
              {...registerProfile("email")}
            />
            <Button type="submit" disabled={isProfileLoading} className="min-h-[44px]">
              {isProfileLoading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              error={passwordErrors.currentPassword?.message}
              {...registerPassword("currentPassword")}
            />
            <Input
              label="New Password"
              type="password"
              error={passwordErrors.newPassword?.message}
              {...registerPassword("newPassword")}
            />
            <Input
              label="Confirm New Password"
              type="password"
              error={passwordErrors.confirmPassword?.message}
              {...registerPassword("confirmPassword")}
            />
            <Button type="submit" disabled={isPasswordLoading} className="min-h-[44px]">
              {isPasswordLoading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
