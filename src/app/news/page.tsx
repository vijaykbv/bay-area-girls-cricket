import { createServerClient } from "@/lib/supabase";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Newspaper } from "lucide-react";

export const metadata: Metadata = { title: "News" };
export const revalidate = 3600;

interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cover_image_url?: string;
  published_at: string;
}

async function getNews(): Promise<NewsPost[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("news")
      .select("id, title, slug, excerpt, cover_image_url, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    return (data as NewsPost[]) ?? [];
  } catch {
    return [];
  }
}

export default async function NewsPage() {
  const posts = await getNews();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">News</h1>
      <p className="text-gray-500 mb-8">Latest updates from Bay Area Girls Cricket.</p>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Newspaper size={48} className="mx-auto mb-3 opacity-30" />
          <p>No news posts yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="card overflow-hidden">
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full h-44 object-cover"
                />
              )}
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-1">
                  {format(new Date(post.published_at), "d MMM yyyy")}
                </p>
                <h2 className="font-bold text-gray-900 leading-snug">{post.title}</h2>
                {post.excerpt && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">{post.excerpt}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
