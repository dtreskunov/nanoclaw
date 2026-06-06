import { readEnvFile } from '../../../env.js';
import { updateContainerConfigScalars } from '../../../db/container-configs.js';
import type { ContainerConfigRow } from '../../../types.js';
import { bareIdForResponse, dbValueFromBareId, getModelDetails } from './models-catalog.js';

export type EffectiveVoiceMode = 'off' | 'transcribe' | 'audio';

export async function deriveVoiceMode(
  provider: string | null,
  model: string | null,
  transcriptionModel: string | null,
): Promise<EffectiveVoiceMode> {
  if (!transcriptionModel) return 'off';
  if (!provider || !model) return 'transcribe';
  const bareModelId = bareIdForResponse(provider, model);
  if (!bareModelId) return 'transcribe';
  const detail = await getModelDetails(provider, bareModelId);
  return detail?.modalitiesIn?.includes('audio') ? 'audio' : 'transcribe';
}

export async function deriveVoiceModeForConfig(
  cfg: Pick<ContainerConfigRow, 'provider' | 'model' | 'voice_mode' | 'transcription_model'> | undefined,
): Promise<EffectiveVoiceMode> {
  if (!cfg) return 'off';
  const envDefaults = readEnvFile(['DEFAULT_PROVIDER', 'DEFAULT_MODEL']);
  const provider = cfg.provider ?? envDefaults.DEFAULT_PROVIDER ?? 'claude';
  const model =
    cfg.model ?? (envDefaults.DEFAULT_MODEL ? dbValueFromBareId(provider, envDefaults.DEFAULT_MODEL) : null);
  return deriveVoiceMode(provider, model, cfg.transcription_model ?? null);
}

export async function reconcileVoiceMode(
  agentGroupId: string,
  cfg: Pick<ContainerConfigRow, 'provider' | 'model' | 'voice_mode' | 'transcription_model'> | undefined,
): Promise<EffectiveVoiceMode> {
  const effective = await deriveVoiceModeForConfig(cfg);
  if (cfg && cfg.voice_mode !== effective) {
    updateContainerConfigScalars(agentGroupId, { voice_mode: effective });
  }
  return effective;
}
