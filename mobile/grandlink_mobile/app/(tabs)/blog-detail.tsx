import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNav';

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content_html: string | null;
  published_at: string | null;
  created_at: string;
  author_name: string | null;
};

type BlogLikeCountRow = {
  blog_id: string;
  like_count: number;
};

function formatDate(d: string | null | undefined) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function stripHtmlToText(html: string) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function renderHtmlContent(html: string) {
  if (!html) return null;

  // Split by common block elements
  const parts = html.split(/(<h[1-6][^>]*>|<\/h[1-6]>|<p[^>]*>|<\/p>|<ul[^>]*>|<\/ul>|<li[^>]*>|<\/li>|<strong[^>]*>|<\/strong>|<b[^>]*>|<\/b>|<em[^>]*>|<\/em>|<i[^>]*>|<\/i>|<a[^>]*>|<\/a>|<br\s*\/?>/gi);

  const elements: React.ReactNode[] = [];
  let currentText = '';
  let inHeading = false;
  let headingLevel = 1;
  let inBold = false;
  let inItalic = false;
  let inLink = false;
  let linkHref = '';

  parts.forEach((part, idx) => {
    if (!part) return;

    if (/<h[1-6]/.test(part)) {
      if (currentText.trim()) {
        elements.push(
          <Text key={`text-${idx}`} style={styles.bodyText}>
            {currentText.trim()}
          </Text>
        );
        currentText = '';
      }
      headingLevel = parseInt(part.match(/h(\d)/)?.[1] || '2');
      inHeading = true;
    } else if (/<\/h[1-6]>/.test(part)) {
      if (currentText.trim()) {
        elements.push(
          <Text
            key={`heading-${idx}`}
            style={[
              styles.heading,
              { fontSize: Math.max(16, 24 - headingLevel * 2) },
            ]}
          >
            {currentText.trim()}
          </Text>
        );
        currentText = '';
      }
      inHeading = false;
    } else if (/<p[^>]*>/.test(part)) {
      // Start of paragraph
    } else if (/<\/p>|<br\s*\/?>/i.test(part)) {
      if (currentText.trim()) {
        elements.push(
          <Text key={`p-${idx}`} style={styles.bodyText}>
            {currentText.trim()}
          </Text>
        );
        currentText = '';
      }
    } else if (/<ul[^>]*>/.test(part)) {
      // Start of list
    } else if (/<\/ul>/.test(part)) {
      // End of list
    } else if (/<li[^>]*>/.test(part)) {
      // Start of list item - will be handled with text
    } else if (/<\/li>/.test(part)) {
      if (currentText.trim()) {
        elements.push(
          <Text key={`li-${idx}`} style={styles.listItem}>
            • {currentText.trim()}
          </Text>
        );
        currentText = '';
      }
    } else if (/<strong[^>]*>|<b[^>]*>/.test(part)) {
      inBold = true;
    } else if (/<\/strong>|<\/b>/.test(part)) {
      inBold = false;
    } else if (/<em[^>]*>|<i[^>]*>/.test(part)) {
      inItalic = true;
    } else if (/<\/em>|<\/i>/.test(part)) {
      inItalic = false;
    } else if (/<a\s+href=["']([^"']+)["']/i.test(part)) {
      linkHref = part.match(/href=["']([^"']+)["']/i)?.[1] || '';
      inLink = true;
    } else if (/<\/a>/.test(part)) {
      inLink = false;
      if (currentText.trim()) {
        elements.push(
          <Text
            key={`link-${idx}`}
            style={styles.link}
            onPress={() => Linking.openURL(linkHref)}
          >
            {currentText.trim()}
          </Text>
        );
        currentText = '';
      }
    } else {
      // Plain text content
      const decodedText = part
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      if (decodedText.trim()) {
        currentText += decodedText;
      }
    }
  });

  if (currentText.trim()) {
    elements.push(
      <Text key="final" style={styles.bodyText}>
        {currentText.trim()}
      </Text>
    );
  }

  return elements.length > 0 ? elements : <Text style={styles.bodyText}>{stripHtmlToText(html)}</Text>;
}

export default function BlogDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [blog, setBlog] = useState<BlogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [recentPosts, setRecentPosts] = useState<BlogRow[]>([]);
  const [recentLikeCounts, setRecentLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchBlog = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch main blog
        const { data, error } = await supabase
          .from('blogs')
          .select('id, title, slug, excerpt, cover_image_url, content_html, published_at, created_at, author_name')
          .eq('id', id)
          .eq('is_published', true)
          .single();

        if (error) throw error;
        if (!data) {
          setBlog(null);
          setLikeCount(0);
          return;
        }

        const blogData = data as BlogRow;
        setBlog(blogData);

        // Fetch like count
        const { data: likeCountData } = await supabase
          .from('blog_like_counts')
          .select('blog_id, like_count')
          .eq('blog_id', blogData.id)
          .maybeSingle();

        setLikeCount(Number((likeCountData as BlogLikeCountRow | null)?.like_count || 0));

        // Fetch recent posts (exclude current blog)
        const { data: recentData, error: recentErr } = await supabase
          .from('blogs')
          .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, author_name, content_html')
          .eq('is_published', true)
          .neq('id', blogData.id)
          .order('published_at', { ascending: false })
          .limit(3);

        if (recentErr) throw recentErr;

        const recentBlogs = (recentData || []) as BlogRow[];
        setRecentPosts(recentBlogs);

        // Fetch like counts for recent posts
        if (recentBlogs.length > 0) {
          const recentIds = recentBlogs.map((r) => r.id);
          const { data: countData } = await supabase
            .from('blog_like_counts')
            .select('blog_id, like_count')
            .in('blog_id', recentIds);

          const counts: Record<string, number> = {};
          (countData || []).forEach((c: any) => {
            counts[String(c.blog_id)] = Number(c.like_count || 0);
          });
          setRecentLikeCounts(counts);
        }
      } catch (e) {
        console.error('blog load error', e);
        setBlog(null);
        setLikeCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [id]);

  const contentText = blog
    ? stripHtmlToText(blog.content_html || blog.excerpt || '')
    : '';

  const contentElements = blog ? renderHtmlContent(blog.content_html || '') : null;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#8B1C1C" />
        <Text style={styles.loadingText}>Loading blog…</Text>
      </View>
    );
  }

  if (!blog) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#8B1C1C" />
        </TouchableOpacity>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Blog not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#8B1C1C" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{blog.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDate(blog.published_at || blog.created_at)}</Text>
          {blog.author_name ? <Text style={styles.author}>By {blog.author_name}</Text> : null}
        </View>

        {blog.cover_image_url ? (
          <Image source={{ uri: blog.cover_image_url }} style={styles.image} resizeMode="cover" />
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={16} color="#8B1C1C" />
            <Text style={styles.statText}>{likeCount} likes</Text>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {contentElements || <Text style={styles.bodyText}>{contentText}</Text>}
        </View>

        {/* Recent Posts Section */}
        {recentPosts.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent Posts</Text>
            {recentPosts.map((post) => {
              const hearts = recentLikeCounts[post.id] || 0;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.recentCard}
                  onPress={() => router.push({ pathname: '/(tabs)/blog-detail', params: { id: post.id } })}
                >
                  {post.cover_image_url ? (
                    <Image source={{ uri: post.cover_image_url }} style={styles.recentImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.recentImagePlaceholder} />
                  )}
                  <View style={styles.recentContent}>
                    <Text style={styles.recentPostTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <View style={styles.recentMeta}>
                      <Text style={styles.recentDate}>{formatDate(post.published_at || post.created_at)}</Text>
                      <View style={styles.recentLikes}>
                        <Ionicons name="heart-outline" size={12} color="#8B1C1C" />
                        <Text style={styles.recentLikeCount}>{hearts}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 100 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtnText: { marginLeft: 8, color: '#8B1C1C', fontSize: 16, fontWeight: '600' },
  image: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  author: { fontSize: 14, color: '#888' },
  date: { fontSize: 14, color: '#888' },
  statsRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, color: '#666', fontWeight: '600' },
  contentContainer: { marginBottom: 24 },
  body: { fontSize: 16, color: '#333', lineHeight: 24 },
  bodyText: { fontSize: 15, color: '#333', lineHeight: 24, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: 'bold', color: '#222', marginTop: 16, marginBottom: 10 },
  listItem: { fontSize: 15, color: '#333', lineHeight: 24, marginLeft: 12, marginBottom: 6 },
  link: { fontSize: 15, color: '#0066cc', textDecorationLine: 'underline' },
  recentSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  recentTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 12 },
  recentCard: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#f9f9f9', borderRadius: 8, overflow: 'hidden', gap: 12 },
  recentImage: { width: 100, height: 100, backgroundColor: '#eee' },
  recentImagePlaceholder: { width: 100, height: 100, backgroundColor: '#eee' },
  recentContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
  recentPostTitle: { fontSize: 14, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  recentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentDate: { fontSize: 12, color: '#999' },
  recentLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentLikeCount: { fontSize: 12, color: '#8B1C1C', fontWeight: '600' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  loadingText: { marginTop: 12, color: '#888', fontSize: 16 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { color: '#888', fontSize: 16 },
});
