import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNav';
import { useAppContext } from '@/context/AppContext';

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

function stripHtmlToText(html: string, preserveMarkers = false) {
  if (!html) return '';
  let text = html
    .replace(/<h1[^>]*>/gi, '\n[[H1]] ')
    .replace(/<h2[^>]*>/gi, '\n[[H2]] ')
    .replace(/<h3[^>]*>/gi, '\n[[H3]] ')
    .replace(/<p[^>]*>/gi, '\n[[P]] ')
    .replace(/<li[^>]*>/gi, '\n[[LI]] ')
    .replace(/<(div|ul|ol)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  if (!preserveMarkers) {
    text = text.replace(/\[\[(H1|H2|H3|P|LI)\]\]/g, ' ').trim();
  }

  return text;
}

function renderDetailLine(text: string, key: string, withBullet = false, highlightFirstLetter = false) {
  const content = text.trim();
  if (!content) return null;

  const firstLetterIndex = content.search(/[A-Za-z0-9]/);
  if (firstLetterIndex < 0) {
    return (
      <Text key={key} style={styles.bodyText}>
        {withBullet ? '\u2022 ' : ''}
        {content}
      </Text>
    );
  }

  const leadingText = content.slice(0, firstLetterIndex);
  const firstLetter = content.charAt(firstLetterIndex);
  const trailingText = content.slice(firstLetterIndex + 1);

  return (
    <Text key={key} style={styles.bodyText}>
      {withBullet ? '\u2022 ' : ''}
      {leadingText}
      {highlightFirstLetter ? <Text style={styles.dropCap}>{firstLetter}</Text> : firstLetter}
      {trailingText}
    </Text>
  );
}

function renderHtmlContent(html: string) {
  if (!html) return null;

  const markedText = stripHtmlToText(html, true);
  if (!markedText.trim()) return null;

  const lines = markedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let firstDetailStyled = false;

  const nodes = lines
    .map((line, index) => {
      const markerMatch = line.match(/^\[\[(H1|H2|H3|P|LI)\]\]\s*/);
      const marker = markerMatch?.[1] ?? null;
      const text = line.replace(/^\[\[(H1|H2|H3|P|LI)\]\]\s*/, '').trim();

      if (!text) return null;

      if (marker === 'H1') {
        return (
          <Text key={`h1-${index}`} style={styles.contentTitleText}>
            {text}
          </Text>
        );
      }

      if (marker === 'H2' || marker === 'H3') {
        return (
          <Text key={`h2-${index}`} style={styles.contentSubtitleText}>
            {text}
          </Text>
        );
      }

      if (/\?\s*$/.test(text)) {
        return (
          <Text key={`q-${index}`} style={styles.questionText}>
            {text}
          </Text>
        );
      }

      const shouldHighlightFirstLetter = !firstDetailStyled;
      firstDetailStyled = true;
      return renderDetailLine(text, `detail-${index}`, marker === 'LI', shouldHighlightFirstLetter);
    })
    .filter(Boolean);

  if (nodes.length === 0) return null;

  return <View>{nodes}</View>;
}

function renderPlainContent(text: string) {
  if (!text.trim()) return null;

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let firstDetailStyled = false;

  const nodes = lines
    .map((line, index) => {
      if (/\?\s*$/.test(line)) {
        return (
          <Text key={`plain-q-${index}`} style={styles.questionText}>
            {line}
          </Text>
        );
      }

      const shouldHighlightFirstLetter = !firstDetailStyled;
      firstDetailStyled = true;
      return renderDetailLine(line, `plain-detail-${index}`, false, shouldHighlightFirstLetter);
    })
    .filter(Boolean);

  if (nodes.length === 0) return null;

  return <View>{nodes}</View>;
}

export default function BlogDetailScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const previewTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const previewExcerpt = Array.isArray(params.excerpt) ? params.excerpt[0] : params.excerpt;
  const previewCover = Array.isArray(params.cover) ? params.cover[0] : params.cover;
  const previewPublishedAt = Array.isArray(params.publishedAt) ? params.publishedAt[0] : params.publishedAt;
  const previewCreatedAt = Array.isArray(params.createdAt) ? params.createdAt[0] : params.createdAt;
  const previewAuthor = Array.isArray(params.authorName) ? params.authorName[0] : params.authorName;

  const hasPreviewData = Boolean(previewTitle || previewExcerpt || previewCover);
  const [blog, setBlog] = useState<BlogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [recentPosts, setRecentPosts] = useState<BlogRow[]>([]);
  const [recentLikeCounts, setRecentLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id || !hasPreviewData) return;

    setBlog((prev) => {
      if (prev?.id === id && prev.title) return prev;
      return {
        id,
        title: previewTitle || 'Blog',
        slug: '',
        excerpt: previewExcerpt || null,
        cover_image_url: previewCover || null,
        content_html: null,
        published_at: previewPublishedAt || null,
        created_at: previewCreatedAt || previewPublishedAt || new Date().toISOString(),
        author_name: previewAuthor || null,
      };
    });
    setLoading(false);
  }, [id, hasPreviewData, previewTitle, previewExcerpt, previewCover, previewPublishedAt, previewCreatedAt, previewAuthor]);

  useEffect(() => {
    const fetchBlog = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      if (!hasPreviewData) {
        setLoading(true);
      }
      setErrorMessage(null);
      try {
        // Fetch main blog
        let { data, error } = await supabase
          .from('blogs')
          .select('id, title, slug, excerpt, cover_image_url, content_html, published_at, created_at, author_name')
          .eq('id', id)
          .eq('is_published', true)
          .single();

        if (error && String(error.message || '').toLowerCase().includes('is_published')) {
          const fallbackRes = await supabase
            .from('blogs')
            .select('id, title, slug, excerpt, cover_image_url, content_html, published_at, created_at, author_name')
            .eq('id', id)
            .not('published_at', 'is', null)
            .single();
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) throw error;
        if (!data) {
          setBlog(null);
          setLikeCount(0);
          return;
        }

        const blogData = data as BlogRow;
        setBlog(blogData);
        // Show the main article immediately; keep loading auxiliary data in background.
        setLoading(false);

        // Fetch like count (non-blocking for first paint)
        const likePromise = supabase
          .from('blog_like_counts')
          .select('blog_id, like_count')
          .eq('blog_id', blogData.id)
          .maybeSingle();

        // Fetch recent posts (exclude current blog) (non-blocking for first paint)
        let { data: recentData, error: recentErr } = await supabase
          .from('blogs')
          .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, author_name, content_html')
          .eq('is_published', true)
          .neq('id', blogData.id)
          .order('published_at', { ascending: false })
          .limit(3);

        if (recentErr && String(recentErr.message || '').toLowerCase().includes('is_published')) {
          const fallbackRecent = await supabase
            .from('blogs')
            .select('id, title, slug, excerpt, cover_image_url, published_at, created_at, author_name, content_html')
            .not('published_at', 'is', null)
            .neq('id', blogData.id)
            .order('published_at', { ascending: false })
            .limit(3);
          recentData = fallbackRecent.data;
          recentErr = fallbackRecent.error;
        }

        const { data: likeCountData } = await likePromise;
        setLikeCount(Number((likeCountData as BlogLikeCountRow | null)?.like_count || 0));

        if (recentErr) {
          console.error('recent posts load error', recentErr);
          return;
        }

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
        const msg = e instanceof Error ? e.message : 'Unable to load blog.';
        setErrorMessage(msg);
        console.error('blog load error', e);
        setBlog(null);
        setLikeCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [id, hasPreviewData]);

  const contentSource = blog?.content_html || blog?.excerpt || '';
  const contentText = useMemo(() => stripHtmlToText(contentSource), [contentSource]);
  const contentElements = useMemo(
    () => (blog?.content_html ? renderHtmlContent(blog.content_html) : null),
    [blog?.content_html]
  );

  // Calculate reading time (average 200 words per minute)
  const readingTime = contentText
    ? Math.max(1, Math.round(contentText.split(/\s+/).length / 200))
    : 0;

  if (loading) {
    return (
      <View style={[styles.loadingBox, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <ActivityIndicator size="large" color="#8B1C1C" />
        <Text style={[styles.loadingText, { color: darkMode ? '#b8b8b8' : '#888' }]}>Loading blog…</Text>
      </View>
    );
  }

  if (!blog) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#8B1C1C" />
        </TouchableOpacity>
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: darkMode ? '#b8b8b8' : '#888' }]}>Blog not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
      <ScrollView style={{ backgroundColor: darkMode ? '#101010' : '#fff' }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          <View style={styles.headerTopOnImage}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
          {blog.cover_image_url ? (
            <Image source={{ uri: blog.cover_image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: '#f0f0f0' }]} />
          )}
        </View>

        {/* Title Card */}
        <View style={styles.titleCard}>
          <Text style={styles.title}>{blog.title}</Text>
          
          {/* Enhanced Meta Information */}
          <View style={styles.metaContainer}>
            <View style={styles.metaLeft}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color="#666" />
                <Text style={styles.metaText}>{formatDate(blog.published_at || blog.created_at)}</Text>
              </View>
              {readingTime > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.metaText}>{readingTime} min read</Text>
                </View>
              )}
            </View>
            {blog.author_name && (
              <View style={styles.authorTag}>
                <Ionicons name="person-circle-outline" size={16} color="#8B1C1C" />
                <Text style={styles.authorName}>{blog.author_name}</Text>
              </View>
            )}
          </View>

          {/* Engagement Stats */}
          <View style={styles.engagementRow}>
            <View style={styles.statItemModern}>
              <Ionicons name="heart-outline" size={18} color="#8B1C1C" />
              <Text style={styles.statTextModern}>{likeCount}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.viewCountText}>Engaging read</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.contentCardWrapper}>
          <View style={styles.contentContainer}>
            {contentElements || renderPlainContent(contentText)}
            {(!contentElements && !contentText) && (
              <Text style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                No content available.
              </Text>
            )}
          </View>
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { paddingBottom: 100 },
  
  // Header Section
  headerTopOnImage: { position: 'absolute', top: 16, left: 16, zIndex: 3 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { marginLeft: 6, color: '#fff', fontSize: 16, fontWeight: '600' },

  // Hero Image
  heroSection: { paddingHorizontal: 0, marginBottom: 0 },
  image: { width: '100%', height: 260, backgroundColor: '#e0e0e0' },

  // Title Card
  titleCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: -20, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 14, lineHeight: 32 },

  // Meta Container
  metaContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  metaLeft: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#666', fontWeight: '500' },
  authorTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(139, 28, 28, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  authorName: { fontSize: 13, color: '#8B1C1C', fontWeight: '600' },

  // Engagement Row
  engagementRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statItemModern: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  statTextModern: { fontSize: 14, color: '#8B1C1C', fontWeight: '700' },
  divider: { width: 1, height: 16, backgroundColor: '#e0e0e0', marginHorizontal: 12 },
  viewCountText: { fontSize: 13, color: '#666', fontStyle: 'italic' },

  // Content Card
  contentCardWrapper: { paddingHorizontal: 16, marginTop: 16 },
  contentContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  body: { fontSize: 16, color: '#333', lineHeight: 26 },
  bodyText: { fontSize: 16, color: '#444', lineHeight: 26, marginBottom: 14, fontWeight: '400' },
  dropCap: {
    fontSize: 38,
    lineHeight: 38,
    fontWeight: '800',
    color: '#8B1C1C',
  },
  sectionBreakParagraph: { marginBottom: 24 },
  contentTitleText: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', lineHeight: 32, marginTop: 12, marginBottom: 12 },
  contentSubtitleText: { fontSize: 19, fontWeight: '700', color: '#2a2a2a', lineHeight: 28, marginTop: 8, marginBottom: 10 },
  questionText: { fontSize: 18, fontWeight: '700', color: '#222', lineHeight: 28, marginTop: 8, marginBottom: 10 },
  questionBlock: {
    backgroundColor: '#FFF6E8',
    borderLeftWidth: 4,
    borderLeftColor: '#8B1C1C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  heading: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginTop: 18, marginBottom: 12, lineHeight: 28 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, paddingRight: 4 },
  listBullet: { width: 18, fontSize: 18, lineHeight: 26, color: '#8B1C1C', fontWeight: '700' },
  listNumber: { minWidth: 28, fontSize: 15, lineHeight: 26, color: '#8B1C1C', fontWeight: '700' },
  listItemText: { flex: 1, fontSize: 16, color: '#444', lineHeight: 26, fontWeight: '400' },
  link: { fontSize: 16, color: '#0066cc', textDecorationLine: 'underline', fontWeight: '600' },

  // Recent Section
  recentSection: { marginTop: 24, paddingHorizontal: 16, paddingTop: 16 },
  recentTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  recentCard: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  recentImage: { width: 100, height: 100, backgroundColor: '#eee' },
  recentImagePlaceholder: { width: 100, height: 100, backgroundColor: '#eee' },
  recentContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
  recentPostTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  recentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentDate: { fontSize: 12, color: '#999' },
  recentLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentLikeCount: { fontSize: 12, color: '#8B1C1C', fontWeight: '700' },

  // Loading & Empty States
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  loadingText: { marginTop: 12, color: '#888', fontSize: 16, fontWeight: '500' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '500' },
  errorText: { marginTop: 8, color: '#B00020', fontSize: 13, textAlign: 'center', paddingHorizontal: 20, fontWeight: '500' },
});
