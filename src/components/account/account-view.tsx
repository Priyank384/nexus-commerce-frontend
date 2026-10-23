"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { AddressPanel } from "./address-panel";
import { ProfilePanel } from "./profile-panel";
import { WishlistPanel } from "./wishlist-panel";

export function AccountView() {
  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <p className="label-caps text-muted-foreground">Your account</p>
        <h1 className="mt-3 text-3xl md:text-4xl">Good to see you.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Keep your details current so delivery and returns stay simple.
        </p>
      </header>

      <Tabs defaultValue="profile" className="gap-10">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-8 border-b p-0"
        >
          <TabsTrigger value="profile" className="flex-none px-0 pb-3">
            Profile
          </TabsTrigger>
          <TabsTrigger value="addresses" className="flex-none px-0 pb-3">
            Addresses
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="flex-none px-0 pb-3">
            Saved pieces
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfilePanel />
        </TabsContent>

        <TabsContent value="addresses">
          <AddressPanel />
        </TabsContent>

        <TabsContent value="wishlist">
          <div className="space-y-8">
            <WishlistPanel />
            <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
              Continue shopping
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
