"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryOptions,
  subtreeIds,
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type AdminCategoryNode,
  type CategoryDraft,
} from "@/lib/admin/categories";

type EditorState =
  | { mode: "create"; parentId: number | null }
  | { mode: "edit"; category: AdminCategoryNode };

type FormState = {
  name: string;
  parentId: string;
  description: string;
  slug: string;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

function formFor(editor: EditorState): FormState {
  if (editor.mode === "edit") {
    return {
      name: editor.category.name ?? "",
      parentId: editor.category.parentId == null ? "" : String(editor.category.parentId),
      description: editor.category.description ?? "",
      slug: editor.category.slug ?? "",
    };
  }
  return {
    name: "",
    parentId: editor.parentId == null ? "" : String(editor.parentId),
    description: "",
    slug: "",
  };
}

function countCategories(nodes: AdminCategoryNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countCategories(node.children ?? []),
    0,
  );
}

function CategoryEditor({
  editor,
  categories,
  onClose,
}: {
  editor: EditorState;
  categories: AdminCategoryNode[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFor(editor));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory(editor.mode === "edit" ? editor.category.id ?? 0 : 0);
  const pending = createCategory.isPending || updateCategory.isPending;

  // A category cannot be its own parent and cannot move under its own subtree.
  const excluded =
    editor.mode === "edit" ? subtreeIds(editor.category) : undefined;
  const parentChoices = categoryOptions(categories, { excludeIds: excluded });
  const parentLabel =
    form.parentId === "" ? "Top level" : parentChoices.find((o) => String(o.id) === form.parentId)?.label;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const draft: CategoryDraft = {
      name: form.name,
      parentId: form.parentId === "" ? null : Number(form.parentId),
      description: form.description,
      slug: form.slug,
    };
    if (!draft.name.trim()) {
      setSubmitError("Give the category a name.");
      return;
    }
    setSubmitError(null);
    const callbacks = {
      onSuccess: () => {
        toast.success(editor.mode === "edit" ? `${draft.name.trim()} updated` : `${draft.name.trim()} created`);
        onClose();
      },
      onError: (error: Error) => setSubmitError(error.message),
    };
    if (editor.mode === "edit") updateCategory.mutate(draft, callbacks);
    else createCategory.mutate(draft, callbacks);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editor.mode === "edit" ? `Edit ${editor.category.name}` : "New category"}
          </DialogTitle>
          <DialogDescription>
            {editor.mode === "edit"
              ? "Rename it, move it under another parent, or detach it to the top level."
              : "Add a top-level category or place it under an existing one."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Knitwear"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="category-parent">Parent</Label>
            <select
              id="category-parent"
              className={selectClass}
              value={form.parentId}
              onChange={(event) => update("parentId", event.target.value)}
            >
              <option value="">Top level</option>
              {parentChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {`${"— ".repeat(option.depth)}${option.label}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {form.parentId === ""
                ? "Appears directly in the shop navigation."
                : `Nested under ${parentLabel ?? "the chosen category"}.`}
            </p>
          </div>

          <div>
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              rows={3}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Soft, considered layers for the shoulder seasons."
            />
          </div>

          <div>
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={form.slug}
              onChange={(event) => update("slug", event.target.value)}
              placeholder="knitwear"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {editor.mode === "edit"
                ? "Leave as is unless the URL needs to change."
                : "Blank derives one from the name."}
            </p>
          </div>

          {submitError ? (
            <p
              role="alert"
              className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editor.mode === "edit" ? "Save category" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category,
  onClose,
}: {
  category: AdminCategoryNode;
  onClose: () => void;
}) {
  const remove = useDeleteCategory();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {category.name}?</DialogTitle>
          <DialogDescription>
            It leaves the shop navigation immediately. A category can only be removed once it has
            no products and no subcategories.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            role="alert"
            className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(category.id!, {
                onSuccess: () => {
                  toast.success(`${category.name} removed`);
                  onClose();
                },
                onError: (error) => setError(error.message),
              });
            }}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryTree({
  nodes,
  depth = 0,
  onAddChild,
  onEdit,
  onDelete,
}: {
  nodes: AdminCategoryNode[];
  depth?: number;
  onAddChild: (node: AdminCategoryNode) => void;
  onEdit: (node: AdminCategoryNode) => void;
  onDelete: (node: AdminCategoryNode) => void;
}) {
  return (
    <ul className={depth === 0 ? "divide-y border-y" : "mt-3 space-y-3 border-l pl-4 sm:pl-6"}>
      {nodes.map((node) => (
        <li key={node.id} className={depth === 0 ? "py-4" : "pt-1"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-lg leading-snug">{node.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                /{node.slug}
                {node.children?.length ? ` · ${node.children.length} direct ${node.children.length === 1 ? "child" : "children"}` : ""}
              </p>
              {node.description ? (
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">{node.description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddChild(node)}
                aria-label={`Add a subcategory to ${node.name}`}
              >
                <Plus aria-hidden className="size-4" />
                Child
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(node)}
                aria-label={`Edit ${node.name}`}
              >
                <Pencil aria-hidden className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(node)}
                aria-label={`Delete ${node.name}`}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
          {node.children?.length ? (
            <CategoryTree
              nodes={node.children}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function AdminCategoriesPage() {
  const { data, isPending, isError, error, refetch } = useAdminCategories();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryNode | null>(null);
  const categories = data ?? [];
  const total = countCategories(categories);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total
              ? `${total} ${total === 1 ? "category" : "categories"}, nested the way shoppers see them.`
              : "The shop's navigation, built from this tree."}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditor({ mode: "create", parentId: null })}>
          <Plus aria-hidden className="size-4" />
          New category
        </Button>
      </header>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Categories could not be loaded</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Please try again."}
          </AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      ) : categories.length === 0 ? (
        <div className="border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg">No categories yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a top-level category to start building the shop navigation.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setEditor({ mode: "create", parentId: null })}>
            <Plus aria-hidden className="size-4" />
            New category
          </Button>
        </div>
      ) : (
        <CategoryTree
          nodes={categories}
          onAddChild={(node) => setEditor({ mode: "create", parentId: node.id ?? null })}
          onEdit={(node) => setEditor({ mode: "edit", category: node })}
          onDelete={setDeleting}
        />
      )}

      {editor ? (
        <CategoryEditor editor={editor} categories={categories} onClose={() => setEditor(null)} />
      ) : null}
      {deleting ? (
        <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </section>
  );
}
