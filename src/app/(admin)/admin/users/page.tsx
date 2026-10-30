"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSetUserEnabled, useSetUserRole, useAdminUsers, type AdminUser } from "@/lib/admin/users";
import { useSession } from "@/lib/auth/session";
import { formatOrderDate } from "@/lib/orders/format";
import { toast } from "sonner";

function DisableUser({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const update = useSetUserEnabled(user.id!);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />
        }
      >
        Disable
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disable {user.name}?</DialogTitle>
          <DialogDescription>
            They can no longer sign in or refresh a session. Existing orders and reviews are kept,
            and you can enable the account again at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep access</DialogClose>
          <Button
            variant="destructive"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(false, {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(`${user.name} disabled`);
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {update.isPending ? "Disabling…" : "Disable account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnableUser({ user }: { user: AdminUser }) {
  const update = useSetUserEnabled(user.id!);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={update.isPending}
      onClick={() =>
        update.mutate(true, {
          onSuccess: () => toast.success(`${user.name} enabled`),
          onError: (error) => toast.error(error.message),
        })
      }
    >
      {update.isPending ? "Enabling…" : "Enable"}
    </Button>
  );
}

/** Promoting is the one click that widens someone's blast radius, so it asks first. */
function ChangeRole({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const update = useSetUserRole(user.id!);
  const promote = user.role !== "ADMIN";
  const role = promote ? "ADMIN" : "USER";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {promote ? "Make admin" : "Remove admin"}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {promote ? `Make ${user.name} an admin?` : `Remove admin rights from ${user.name}?`}
          </DialogTitle>
          <DialogDescription>
            {promote
              ? "Admins can edit the catalogue, prices, orders, inventory and other accounts. Grant this only to people who need it."
              : "They keep their account and order history but lose access to the admin console on their next request."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant={promote ? "default" : "destructive"}
            disabled={update.isPending}
            onClick={() =>
              update.mutate(role, {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(promote ? `${user.name} is now an admin` : `${user.name} is a shopper again`);
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {update.isPending ? "Saving…" : promote ? "Make admin" : "Remove admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({ users, currentUserId }: { users: AdminUser[]; currentUserId?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead className="hidden md:table-cell">Phone</TableHead>
          <TableHead className="hidden sm:table-cell">Joined</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-40 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <TableRow key={user.id}>
              <TableCell>
                <p className="text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {user.phone || "—"}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                {formatOrderDate(user.createdAt)}
              </TableCell>
              <TableCell>
                <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                  {user.role === "ADMIN" ? "Admin" : "Shopper"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.enabled === false ? "destructive" : "secondary"}>
                  {user.enabled === false ? "Disabled" : "Active"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {isSelf ? (
                  <span className="text-xs text-muted-foreground">This is you</span>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <ChangeRole user={user} />
                    {user.enabled === false ? <EnableUser user={user} /> : <DisableUser user={user} />}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function AdminUsersPage() {
  const [rawKeyword, setRawKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const currentUser = useSession((state) => state.user);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(rawKeyword.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawKeyword]);

  const { data, isPending, isError, error, refetch, isFetching } = useAdminUsers(page, keyword);
  const users = data?.content ?? [];
  const total = data?.totalElements ?? 0;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total ? `${total} accounts, newest first` : "Every account, newest first."}
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 border-y py-3">
        <Input
          value={rawKeyword}
          onChange={(event) => setRawKeyword(event.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="max-w-sm bg-transparent"
        />
        {isFetching && !isPending ? (
          <span className="label-caps text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Users could not be loaded</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      ) : users.length === 0 ? (
        <div className="border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg">Nothing matches &ldquo;{keyword}&rdquo;.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different name or email.</p>
        </div>
      ) : (
        <UsersTable users={users} currentUserId={currentUser?.id} />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Page {(data?.page ?? 0) + 1} of {Math.max(data?.totalPages ?? 1, 1)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data?.last ?? true}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
