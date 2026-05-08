
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Image,
	ImageBackground,
	TouchableOpacity,
	TextInput,
	ActivityIndicator,
	Modal,
	Pressable,
	Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNav';
import type { User } from '@supabase/supabase-js';
import { useAppContext } from '@/context/AppContext';

type Blog = {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	cover_image_url: string | null;
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

export default function BlogsScreen() {
  const { darkMode } = useAppContext();
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [blogs, setBlogs] = useState<Blog[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
	const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
	const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
	const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
	const [imgPopup, setImgPopup] = useState<{ open: boolean; url: string; alt?: string }>({ open: false, url: '' });
	const [toast, setToast] = useState<string | null>(null);

	useEffect(() => {
		const loadUser = async () => {
			const { data } = await supabase.auth.getUser();
			setUser(data?.user ?? null);
		};
		loadUser();
	}, []);

	const load = async () => {
		setLoading(true);
		setErrorMessage(null);
		try {
			let { data, error } = await supabase
				.from('blogs')
				.select('id, title, slug, excerpt, cover_image_url, published_at, created_at, author_name')
				.eq('is_published', true)
				.order('published_at', { ascending: false })
				.limit(200);

			if (error && String(error.message || '').toLowerCase().includes('is_published')) {
				const fallbackRes = await supabase
					.from('blogs')
					.select('id, title, slug, excerpt, cover_image_url, published_at, created_at, author_name')
					.not('published_at', 'is', null)
					.order('published_at', { ascending: false })
					.limit(200);
				data = fallbackRes.data;
				error = fallbackRes.error;
			}

			if (error) throw error;

			const rows = (data || []) as Blog[];
			setBlogs(rows);

			const ids = rows.map((b) => b.id).filter(Boolean);
			if (ids.length === 0) {
				setLikeCounts({});
				setLikedByMe({});
				return;
			}

			const likeCountsReq = supabase.from('blog_like_counts').select('blog_id, like_count').in('blog_id', ids);
			const myLikesReq = user?.id
				? supabase.from('blog_likes').select('blog_id').eq('user_id', user.id).in('blog_id', ids)
				: Promise.resolve({ data: [] as { blog_id: string }[] });

			const [{ data: likeCountsRows }, { data: myLikes }] = await Promise.all([likeCountsReq, myLikesReq]);

			const counts: Record<string, number> = {};
			(likeCountsRows as BlogLikeCountRow[] | null | undefined)?.forEach((r) => {
				counts[String(r.blog_id)] = Number(r.like_count || 0);
			});
			setLikeCounts(counts);

			const mine: Record<string, boolean> = {};
			(myLikes || []).forEach((r: { blog_id: string }) => {
				mine[String(r.blog_id)] = true;
			});
			setLikedByMe(mine);

			// Views (includes guests)
			try {
				const res = await fetch(`https://grandlnik-website.vercel.app/api/blogs/views?ids=${encodeURIComponent(ids.join(','))}`);
				const j = await res.json().catch(() => ({}));
				if (res.ok && j?.counts && typeof j.counts === 'object') {
					setViewCounts(j.counts as Record<string, number>);
				} else {
					setViewCounts({});
				}
			} catch {
				setViewCounts({});
			}
		} catch (e) {
			console.error('blogs load error', e);
			const msg = e instanceof Error ? e.message : 'Unable to load blogs right now.';
			setErrorMessage(msg);
			setBlogs([]);
			setLikeCounts({});
			setLikedByMe({});
			setViewCounts({});
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	// Realtime refresh when blogs change
	useEffect(() => {
		const ch = supabase
			.channel('website_blogs')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'blogs' }, () => load())
			.on('postgres_changes', { event: '*', schema: 'public', table: 'blog_likes' }, () => load())
			.subscribe();

		return () => {
			try {
				supabase.removeChannel(ch);
			} catch {}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id]);

	const filteredBlogs = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return blogs;
		return blogs.filter((b) => {
			const title = String(b.title || '').toLowerCase();
			const excerpt = String(b.excerpt || '').toLowerCase();
			const author = String(b.author_name || '').toLowerCase();
			return title.includes(q) || excerpt.includes(q) || author.includes(q);
		});
	}, [blogs, searchQuery]);

	const sortedFilteredBlogs = useMemo(() => {
		return [...filteredBlogs].sort((a, b) => {
			const aDate = new Date(a.published_at || a.created_at).getTime();
			const bDate = new Date(b.published_at || b.created_at).getTime();

			if (sortOrder === 'oldest') return aDate - bDate;
			return bDate - aDate;
		});
	}, [filteredBlogs, sortOrder]);

	const showToast = (msg: string) => {
		setToast(msg);
		setTimeout(() => setToast(null), 2500);
	};

	const toggleLike = async (blogId: string) => {
		if (!user?.id) {
			showToast('Please log in to heart blogs.');
			return;
		}

		const isLiked = !!likedByMe[blogId];
		setLikedByMe((p) => ({ ...p, [blogId]: !isLiked }));
		setLikeCounts((p) => ({ ...p, [blogId]: Math.max(0, (p[blogId] || 0) + (isLiked ? -1 : 1)) }));

		try {
			if (isLiked) {
				const { error } = await supabase.from('blog_likes').delete().eq('blog_id', blogId).eq('user_id', user.id);
				if (error) throw error;
			} else {
				const { error } = await supabase.from('blog_likes').insert({ blog_id: blogId, user_id: user.id });
				if (error) throw error;
			}
		} catch (e) {
			console.error('toggle like error', e);
			// rollback
			setLikedByMe((p) => ({ ...p, [blogId]: isLiked }));
			setLikeCounts((p) => ({ ...p, [blogId]: Math.max(0, (p[blogId] || 0) + (isLiked ? 1 : -1)) }));
			showToast('Could not update heart. Please try again.');
		}
	};

	const shareBlog = async (slug: string, title: string) => {
		const url = `https://grandlnik-website.vercel.app/blogs/${slug}`;

		try {
			if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.share) {
				await navigator.share({ title, url });
				return;
			}
			showToast('Link copied to clipboard.');
		} catch (e) {
			console.error('share error', e);
			showToast('Could not share.');
		}
	};

	const sortLabel = sortOrder === 'newest' ? 'Newest' : 'Oldest';

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
			<ImageBackground
				source={require('@/assets/images/featuredprod3.png')}
				style={styles.headerWrap}
				imageStyle={styles.headerBgImage}
			>
				<View style={styles.headerOverlay}>
					<View style={styles.headerTopRow}>
						<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
							<Ionicons name="arrow-back" size={22} color="#fff" />
							<Text style={styles.backButtonText}>Back</Text>
						</TouchableOpacity>
						<Text style={styles.headerTitle}>Blogs</Text>
					</View>
					<Text style={styles.headerSubtitle}>Read the newest updates, tips, and inspiration from Grand Link.</Text>
				</View>
			</ImageBackground>
			<View style={[styles.searchBox, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
				<View style={styles.searchControlsRow}>
					<View style={[styles.searchInputWrap, { backgroundColor: darkMode ? '#1e1e1e' : '#f3f3f3', borderColor: darkMode ? '#333' : '#eee' }]}>
						<Ionicons name="search-outline" size={18} color={darkMode ? '#9a9a9a' : '#999'} />
						<TextInput
							value={searchQuery}
							onChangeText={setSearchQuery}
							placeholder="Search blogs"
							placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
							style={[styles.searchInput, { color: darkMode ? '#f2f2f2' : '#222' }]}
						/>
					</View>
					<TouchableOpacity style={[styles.sortDropdownTrigger, { backgroundColor: darkMode ? '#1e1e1e' : '#f8f8f8', borderColor: darkMode ? '#333' : '#ddd' }]} onPress={() => setSortDropdownOpen((prev) => !prev)}>
						<Ionicons name="options-outline" size={18} color={darkMode ? '#c6c6c6' : '#555'} />
						<Text style={styles.sortOrderText}>{sortLabel}</Text>
					</TouchableOpacity>
				</View>
				{sortDropdownOpen && (
					<View style={[styles.inlineDropdownMenu, { backgroundColor: darkMode ? '#1e1e1e' : '#fff', borderColor: darkMode ? '#333' : '#eee' }]}>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setSortOrder('newest');
								setSortDropdownOpen(false);
							}}
						>
							<Text style={[styles.dropdownItemText, { color: darkMode ? '#e2e2e2' : '#333' }, sortOrder === 'newest' && styles.dropdownItemTextActive]}>Newest</Text>
							{sortOrder === 'newest' && <Ionicons name="checkmark" size={18} color="#8B1C1C" />}
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setSortOrder('oldest');
								setSortDropdownOpen(false);
							}}
						>
							<Text style={[styles.dropdownItemText, { color: darkMode ? '#e2e2e2' : '#333' }, sortOrder === 'oldest' && styles.dropdownItemTextActive]}>Oldest</Text>
							{sortOrder === 'oldest' && <Ionicons name="checkmark" size={18} color="#8B1C1C" />}
						</TouchableOpacity>
					</View>
				)}
			</View>
			{loading ? (
				<View style={styles.loadingBox}>
					<ActivityIndicator size="large" color="#8B1C1C" />
					<Text style={[styles.loadingText, { color: darkMode ? '#b8b8b8' : '#888' }]}>Loading blogs…</Text>
				</View>
			) : errorMessage ? (
				<View style={styles.emptyBox}>
					<Text style={[styles.emptyText, { color: darkMode ? '#b8b8b8' : '#888' }]}>Could not load blogs.</Text>
					<Text style={styles.errorText}>{errorMessage}</Text>
				</View>
			) : sortedFilteredBlogs.length === 0 ? (
				<View style={styles.emptyBox}>
					<Text style={[styles.emptyText, { color: darkMode ? '#b8b8b8' : '#888' }]}>No blogs yet.</Text>
				</View>
			) : (
				<ScrollView contentContainerStyle={styles.blogList}>
					{sortedFilteredBlogs.map((b) => {
						const hearts = likeCounts[b.id] || 0;
						const isLiked = !!likedByMe[b.id];
						const views = viewCounts[b.id] || 0;
						return (
							<TouchableOpacity
								key={b.id}
								style={[styles.blogCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}
								onPress={() =>
									router.push({
										pathname: '/(tabs)/blog-detail',
										params: {
											id: b.id,
											title: b.title || '',
											excerpt: b.excerpt || '',
											cover: b.cover_image_url || '',
											publishedAt: b.published_at || '',
											createdAt: b.created_at || '',
											authorName: b.author_name || '',
										},
									})
								}
								activeOpacity={0.85}
							>
								<TouchableOpacity
									onPress={() => setImgPopup({ open: true, url: b.cover_image_url || '', alt: b.title })}
									disabled={!b.cover_image_url}
									style={styles.imageBox}
								>
									{b.cover_image_url ? (
										<Image source={{ uri: b.cover_image_url }} style={styles.blogImage} resizeMode="cover" />
									) : (
										<View style={styles.noImage} />
									)}
								</TouchableOpacity>
								<View style={styles.blogContent}>
									<Text style={[styles.date, { color: darkMode ? '#9e9e9e' : '#888' }]}>{formatDate(b.published_at || b.created_at)}</Text>
									<Text style={[styles.title, { color: darkMode ? '#f2f2f2' : '#222' }]}>{b.title}</Text>
									<Text style={[styles.excerpt, { color: darkMode ? '#c5c5c5' : '#444' }]}>{b.excerpt || ''}</Text>
									<View style={styles.actionsRow}>
										<TouchableOpacity onPress={() => shareBlog(b.slug, b.title)} style={styles.actionBtn}>
											<Ionicons name="share-social-outline" size={20} color="#8B1C1C" />
										</TouchableOpacity>
										<TouchableOpacity onPress={() => toggleLike(b.id)} style={styles.actionBtn}>
											{isLiked ? (
												<Ionicons name="heart" size={20} color="#8B1C1C" />
											) : (
												<Ionicons name="heart-outline" size={20} color={darkMode ? '#9e9e9e' : '#888'} />
											)}
											<Text style={styles.heartCount}>{hearts}</Text>
										</TouchableOpacity>
										<Text style={[styles.views, { color: darkMode ? '#9e9e9e' : '#888' }]}>{views} views</Text>
									</View>
										<Text style={[styles.author, { color: darkMode ? '#9e9e9e' : '#888' }]}>{b.author_name ? `By ${b.author_name}` : ''}</Text>
								</View>
							</TouchableOpacity>
						);
					})}
				</ScrollView>
			)}
			{/* Image Popup */}
			<Modal visible={imgPopup.open} transparent animationType="fade">
				<Pressable style={styles.modalOverlay} onPress={() => setImgPopup({ open: false, url: '' })}>
					<View style={[styles.modalContent, { backgroundColor: darkMode ? '#1e1e1e' : '#fff' }]}>
						<Image source={{ uri: imgPopup.url }} style={styles.popupImage} resizeMode="contain" />
						<TouchableOpacity style={styles.closeBtn} onPress={() => setImgPopup({ open: false, url: '' })}>
							<Text style={styles.closeBtnText}>Close</Text>
						</TouchableOpacity>
					</View>
				</Pressable>
			</Modal>

			{/* Toast */}
			{toast && (
				<View style={styles.toast}>
					<Text style={styles.toastText}>{toast}</Text>
				</View>
			)}
			<BottomNavBar />
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	headerWrap: { width: '100%', minHeight: 130 },
	headerBgImage: { resizeMode: 'cover' },
	headerOverlay: { backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
	headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 32, position: 'relative' },
	headerRightSpacer: { width: 62 },
	header: { paddingTop: 12, paddingBottom: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
	headerContent: { alignItems: 'center' },
	backButton: { flexDirection: 'row', alignItems: 'center', position: 'absolute', left: 0, zIndex: 1 },
	backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 4 },
	headerTitle: { width: '100%', fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', paddingHorizontal: 56 },
	headerSubtitle: { color: '#fff', marginTop: 6, fontSize: 13, textAlign: 'center', paddingHorizontal: 8, marginBottom: 0 },
	searchBox: { padding: 16, backgroundColor: '#fff' },
	searchControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	searchInputWrap: { flex: 1, minHeight: 44, backgroundColor: '#f3f3f3', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', gap: 8 },
	searchInput: { flex: 1, fontSize: 15, color: '#222', paddingVertical: 10 },
	sortDropdownTrigger: { minHeight: 44, minWidth: 116, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f8f8' },
	sortOrderText: { fontSize: 13, color: '#8B1C1C', fontWeight: '700' },
	inlineDropdownMenu: { marginTop: 8, alignSelf: 'flex-end', width: 160, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
	dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	dropdownItemText: { fontSize: 15, color: '#333' },
	dropdownItemTextActive: { color: '#8B1C1C', fontWeight: '700' },
	loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
	loadingText: { marginTop: 12, color: '#888', fontSize: 16 },
	emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
	emptyText: { color: '#888', fontSize: 16 },
	errorText: { marginTop: 8, color: '#B00020', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
	blogList: { padding: 16, paddingBottom: 100 },
	blogCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 18, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
	imageBox: { width: '100%', height: 180, backgroundColor: '#eee' },
	blogImage: { width: '100%', height: '100%' },
	noImage: { width: '100%', height: '100%', backgroundColor: '#eee' },
	blogContent: { padding: 16 },
	date: { fontSize: 12, color: '#888', marginBottom: 4 },
	title: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 6 },
	excerpt: { fontSize: 14, color: '#444', marginBottom: 10 },
	actionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
	actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
	heartCount: { marginLeft: 4, fontSize: 14, color: '#8B1C1C' },
	views: { fontSize: 12, color: '#888' },
	author: { fontSize: 13, color: '#888', marginTop: 2 },
	modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
	modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', maxWidth: '90%' },
	popupImage: { width: 320, height: 320, maxWidth: '100%', maxHeight: 400, borderRadius: 8 },
	closeBtn: { marginTop: 16, backgroundColor: '#8B1C1C', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
	closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
	toast: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
	toastText: { backgroundColor: '#222', color: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, fontSize: 15 },
});
