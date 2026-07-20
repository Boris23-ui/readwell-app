import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Book, Segment } from '@/types';
import { splitIntoParagraphs, groupIntoSegments, buildPdfSegments, countWords, randomCoverColor } from '@/utils/content';
import { extractTextFromFile, renderPdf, RenderPdfResult } from '@/utils/api';

// Mobile-only import — resolved at runtime so web bundle is not affected
let DocumentPicker: typeof import('expo-document-picker') | null = null;
if (Platform.OS !== 'web') {
  try {
    DocumentPicker = require('expo-document-picker');
  } catch {}
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown'];
const ACCEPTED_MIME = 'application/pdf,text/plain,text/markdown,text/html';

// ─── File Drop Zone (web-only inner component) ───────────────────────────────

function WebDropZone({
  onFile,
  isDragging,
  setIsDragging,
  isExtracting,
  colors,
}: {
  onFile: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isExtracting: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile, setIsDragging],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so the same file can be re-selected
    if (e.target) e.target.value = '';
  };

  return (
    // @ts-ignore — div is valid inside React Native Web
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnter={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      style={{
        borderRadius: 18,
        borderWidth: 2,
        borderStyle: isDragging ? 'solid' : 'dashed',
        borderColor: isDragging ? colors.primary : colors.border,
        backgroundColor: isDragging ? `${colors.primary}10` : colors.card,
        padding: 32,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onClick={() => !isExtracting && inputRef.current?.click()}
    >
      {/* Hidden real file input */}
      {/* @ts-ignore */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME}
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {isExtracting ? (
        <>
          {/* @ts-ignore */}
          <div style={{ marginBottom: 4 }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </div>
          {/* @ts-ignore */}
          <span style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
            Extracting text…
          </span>
          {/* @ts-ignore */}
          <span style={{ fontSize: 13, color: colors.mutedForeground }}>
            This only takes a second
          </span>
        </>
      ) : isDragging ? (
        <>
          {/* @ts-ignore */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: `${colors.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="download" size={28} color={colors.primary} />
          </div>
          {/* @ts-ignore */}
          <span style={{ fontSize: 17, fontWeight: '700', color: colors.primary }}>
            Drop it here!
          </span>
        </>
      ) : (
        <>
          {/* @ts-ignore */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Feather name="upload" size={26} color={colors.mutedForeground} />
          </div>
          {/* @ts-ignore */}
          <span
            style={{ fontSize: 16, fontWeight: '600', color: colors.foreground, textAlign: 'center' }}
          >
            Drop a file here
          </span>
          {/* @ts-ignore */}
          <span
            style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: '1.5' }}
          >
            or click to browse
          </span>
          {/* @ts-ignore */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: 4,
            }}
          >
            {ACCEPTED_EXTENSIONS.map(ext => (
              // @ts-ignore
              <span
                key={ext}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: colors.mutedForeground,
                  backgroundColor: colors.muted,
                  padding: '3px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {ext.replace('.', '')}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Mobile Picker Button ─────────────────────────────────────────────────────

function MobilePickerButton({
  onFilePicked,
  isExtracting,
  colors,
}: {
  onFilePicked: (uri: string, name: string, mimeType: string) => void;
  isExtracting: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const handlePick = async () => {
    if (!DocumentPicker) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'text/markdown'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        onFilePicked(asset.uri, asset.name ?? 'document', asset.mimeType ?? 'application/octet-stream');
      }
    } catch (e) {
      console.error('DocumentPicker error', e);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePick}
      disabled={isExtracting}
      style={[
        styles.mobilePickerBtn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isExtracting ? 0.6 : 1,
        },
      ]}
      activeOpacity={0.75}
    >
      {isExtracting ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.mobilePickerText, { color: colors.foreground }]}>
            Extracting text…
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.mobilePickerIcon, { backgroundColor: colors.muted }]}>
            <Feather name="upload" size={22} color={colors.mutedForeground} />
          </View>
          <View style={styles.mobilePickerLabel}>
            <Text style={[styles.mobilePickerText, { color: colors.foreground }]}>
              Choose a file
            </Text>
            <Text style={[styles.mobilePickerSub, { color: colors.mutedForeground }]}>
              PDF, TXT, or Markdown
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Extracted file badge ────────────────────────────────────────────────────

function FileBadge({
  filename,
  charCount,
  isPdf,
  pageCount,
  onClear,
  colors,
}: {
  filename: string;
  charCount: number;
  isPdf?: boolean;
  pageCount?: number;
  onClear: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.fileBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
      <Feather name={isPdf ? 'file-text' : 'file'} size={18} color={colors.primary} />
      <View style={styles.fileBadgeInfo}>
        <Text style={[styles.fileBadgeName, { color: colors.foreground }]} numberOfLines={1}>
          {filename}
        </Text>
        <Text style={[styles.fileBadgeMeta, { color: colors.mutedForeground }]}>
          {isPdf && pageCount
            ? `${pageCount} page${pageCount !== 1 ? 's' : ''} rendered`
            : `${(charCount / 1000).toFixed(1)}k characters extracted`}
        </Text>
      </View>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x-circle" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBook } = useApp();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [processing, setProcessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [sourceFile, setSourceFile] = useState<{ name: string; chars: number } | null>(null);
  const [pdfData, setPdfData] = useState<RenderPdfResult | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const canProcess =
    title.trim().length > 0 &&
    (pdfData ? pdfData.pages.length > 0 : content.trim().length > 50);
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;

  // ── Shared handler: receives extracted text from any source ──────────────

  const applyExtractedText = (text: string, suggestedTitle: string, filename: string) => {
    setPdfData(null);
    setContent(text);
    if (!title.trim() && suggestedTitle) setTitle(suggestedTitle);
    setSourceFile({ name: filename, chars: text.length });
    setError('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── PDF: render pages on the server, then build a page-based book ──────────

  const handlePdfFile = async (file: File, filename: string) => {
    setStatusMsg('Rendering pages…');
    try {
      const result = await renderPdf(file);
      setStatusMsg('');
      setPdfData(result);
      // Combined text feeds quiz generation and the word count.
      const combinedText = result.pages.map(p => p.text).join('\n\n').trim();
      setContent(combinedText);
      if (!title.trim() && result.suggestedTitle) setTitle(result.suggestedTitle);
      setSourceFile({ name: filename, chars: combinedText.length });
      setError('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      // Page-cap or oversized errors should surface, not silently fall back.
      const msg = e?.message ?? '';
      if (/maximum supported|too large|pages/i.test(msg)) {
        setStatusMsg('');
        throw e;
      }
      // Otherwise fall back to a text-only book so the user is never blocked.
      setStatusMsg('Rendering failed — importing as text…');
      const result = await extractTextFromFile(file);
      applyExtractedText(result.text, result.suggestedTitle, filename);
      setStatusMsg('');
    }
  };

  // ── Web: file dropped / browsed ──────────────────────────────────────────

  const handleWebFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'txt', 'md', 'markdown', 'html', 'htm'].includes(ext)) {
      setError(`Unsupported file type ".${ext}". Please use PDF, TXT, or Markdown.`);
      return;
    }

    setExtracting(true);
    setError('');

    try {
      if (ext === 'pdf') {
        // PDF → render pages on the server
        await handlePdfFile(file, file.name);
      } else {
        // Plain text → read directly in browser
        const text = await file.text();
        const rawName = file.name.replace(/\.[^.]+$/, '');
        const suggestedTitle = rawName.replace(/[-_]/g, ' ').trim();
        applyExtractedText(text, suggestedTitle, file.name);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to extract text from file.');
    } finally {
      setExtracting(false);
      setStatusMsg('');
    }
  };

  // ── Mobile: document picked ──────────────────────────────────────────────

  const handleMobileFile = async (uri: string, name: string, mimeType: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    setExtracting(true);
    setError('');

    try {
      if (mimeType === 'application/pdf' || ext === 'pdf') {
        // Fetch the local file and send to backend as a Blob
        const fileResponse = await fetch(uri);
        const blob = await fileResponse.blob();
        const file = new File([blob], name, { type: 'application/pdf' });
        await handlePdfFile(file, name);
      } else {
        // Plain text — read directly
        const textResponse = await fetch(uri);
        const text = await textResponse.text();
        const rawName = name.replace(/\.[^.]+$/, '');
        applyExtractedText(text, rawName.replace(/[-_]/g, ' ').trim(), name);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to read file.');
    } finally {
      setExtracting(false);
      setStatusMsg('');
    }
  };

  // ── Process (build book) ─────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!canProcess) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);
    setError('');

    try {
      const bookId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      let book: Book;

      if (pdfData) {
        // Page-based PDF book
        const pages = pdfData.pages.map(p => ({
          pageNumber: p.pageNumber,
          imageUrl: p.imageUrl,
          width: p.width,
          height: p.height,
          text: p.text,
        }));
        const segments = buildPdfSegments(pages, 3);
        book = {
          id: bookId,
          title: title.trim(),
          author: author.trim(),
          content: content.trim(),
          segments,
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          wordCount: countWords(content),
          currentSegmentIndex: 0,
          coverColor: randomCoverColor(),
          sourceType: 'pdf',
          pages,
        };
      } else {
        const paragraphs = splitIntoParagraphs(content.trim());
        if (paragraphs.length < 2) {
          setError('Not enough content. Please add at least a few paragraphs.');
          setProcessing(false);
          return;
        }

        const rawSegments = groupIntoSegments(paragraphs, 5);
        const segments: Segment[] = rawSegments.map((paragraphGroup, i) => ({
          index: i,
          paragraphs: paragraphGroup,
        }));

        book = {
          id: bookId,
          title: title.trim(),
          author: author.trim(),
          content: content.trim(),
          segments,
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          wordCount: countWords(content),
          currentSegmentIndex: 0,
          coverColor: randomCoverColor(),
          sourceType: 'text',
        };
      }

      await addBook(book);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/reader/${book.id}`);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add Book</Text>
          <TouchableOpacity
            onPress={handleProcess}
            disabled={!canProcess || processing || extracting}
            style={[
              styles.addBtn,
              { backgroundColor: canProcess && !extracting ? colors.primary : colors.muted },
            ]}
          >
            {processing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.addBtnText, { color: canProcess && !extracting ? '#FFF' : colors.mutedForeground }]}>
                Add
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── File upload zone ─────────────────────────────── */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              Import from file
            </Text>

            {Platform.OS === 'web' ? (
              <WebDropZone
                onFile={handleWebFile}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                isExtracting={extracting}
                colors={colors}
              />
            ) : (
              <MobilePickerButton
                onFilePicked={handleMobileFile}
                isExtracting={extracting}
                colors={colors}
              />
            )}

            {/* Render/upload progress */}
            {extracting && statusMsg.length > 0 && (
              <View style={[styles.statusRow, { backgroundColor: `${colors.primary}12` }]}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.statusText, { color: colors.foreground }]}>{statusMsg}</Text>
              </View>
            )}

            {/* Extracted file badge */}
            {sourceFile && !extracting && (
              <FileBadge
                filename={sourceFile.name}
                charCount={sourceFile.chars}
                isPdf={!!pdfData}
                pageCount={pdfData?.pageCount}
                onClear={() => {
                  setSourceFile(null);
                  setContent('');
                  setPdfData(null);
                }}
                colors={colors}
              />
            )}
          </View>

          {/* ── Divider ────────────────────────────────────── */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or paste text</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* ── Title ──────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. The Great Gatsby — Chapter 1"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {/* ── Author ─────────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Author (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. F. Scott Fitzgerald"
              placeholderTextColor={colors.mutedForeground}
              value={author}
              onChangeText={setAuthor}
              returnKeyType="next"
            />
          </View>

          {/* ── Content ────────────────────────────────────── */}
          <View style={styles.field}>
            <View style={styles.contentHeader}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Content *</Text>
              {content.length > 0 && (
                <Text style={[styles.wordCount, { color: colors.mutedForeground }]}>
                  ~{countWords(content).toLocaleString()} words
                </Text>
              )}
            </View>
            <TextInput
              style={[
                styles.contentInput,
                { backgroundColor: colors.card, borderColor: sourceFile ? `${colors.primary}50` : colors.border, color: colors.foreground },
              ]}
              placeholder="Paste your text here, or import a file above…"
              placeholderTextColor={colors.mutedForeground}
              value={content}
              onChangeText={v => {
                setContent(v);
                if (sourceFile) setSourceFile(null); // manual edit breaks file link
              }}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Error ──────────────────────────────────────── */}
          {error.length > 0 && (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}30` }]}>
              <Feather name="alert-circle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {/* ── Segment preview ────────────────────────────── */}
          {content.trim().length > 50 && (
            <View style={[styles.previewBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="layers" size={14} color={colors.mutedForeground} />
              <Text style={[styles.previewText, { color: colors.mutedForeground }]}>
                ~{Math.max(1, Math.ceil(splitIntoParagraphs(content).length / 5))} reading segments will be created
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  addBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, gap: 18 },

  // File upload section
  sectionBlock: { gap: 10 },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Mobile picker
  mobilePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  mobilePickerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mobilePickerLabel: { flex: 1 },
  mobilePickerText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  mobilePickerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // File badge
  fileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginTop: 4,
  },
  fileBadgeInfo: { flex: 1 },
  fileBadgeName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fileBadgeMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  statusText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  // Fields
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  contentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 180,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  previewText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
