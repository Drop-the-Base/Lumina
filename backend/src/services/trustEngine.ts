import { supabase } from '../db/supabase';

export const REPUTATION_THRESHOLD = 0.3;
const VALIDATION_BOOST = 0.1;
const CONTRADICTION_PENALTY = 0.3;

export async function checkReputation(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .select('reputation_score')
    .eq('user_id', userId)
    .single();

  if (error || !data) return 1.0; // Default to trusted if user not found
  return data.reputation_score;
}

export async function applyValidation(
  reportId: string,
  validatorId: string,
  verdict: 'safe' | 'unsafe'
): Promise<void> {
  // Get the report and its author
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('author_id, validation_count, status')
    .eq('report_id', reportId)
    .single();

  if (reportError || !report) throw new Error('Report not found');
  if (report.status === 'Shadowbanned') return; // Silently ignore

  const authorId = report.author_id;

  if (verdict === 'unsafe') {
    // Report confirmed — boost author, increment validation count
    await supabase
      .from('reports')
      .update({ validation_count: report.validation_count + 1 })
      .eq('report_id', reportId);

    if (authorId) {
      await adjustReputation(authorId, VALIDATION_BOOST);
    }
  } else {
    // Report contradicted — penalize author
    if (authorId) {
      await adjustReputation(authorId, -CONTRADICTION_PENALTY);
    }

    // If contradictions outweigh validations, resolve the report
    if (report.validation_count <= 0) {
      await supabase
        .from('reports')
        .update({ status: 'Resolved' })
        .eq('report_id', reportId);
    }
  }

  // Update validator's total_reports_validated count
  await supabase.rpc('increment_validated', { uid: validatorId }).maybeSingle();
}

async function adjustReputation(userId: string, delta: number): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('reputation_score')
    .eq('user_id', userId)
    .single();

  if (!user) return;

  const newScore = Math.max(0, Math.min(1, user.reputation_score + delta));

  await supabase
    .from('users')
    .update({ reputation_score: newScore })
    .eq('user_id', userId);
}
