const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function utf8Bytes(value: string): number[] {
  const output: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);
    if (code < 0x80) output.push(code);
    else if (code < 0x800) output.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) throw new Error('Invalid UTF-16 surrogate pair');
      index += 1;
      code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
      output.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else output.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return output;
}

function sha256(value: string): string {
  const bytes = utf8Bytes(value);
  const originalLength = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLength = originalLength * 8;
  for (let index = 7; index >= 0; index -= 1) {
    bytes.push(Math.floor(bitLength / 2 ** (index * 8)) & 0xff);
  }

  let hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] = ((bytes[base]! << 24) | (bytes[base + 1]! << 16) | (bytes[base + 2]! << 8) | bytes[base + 3]!) | 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]!;
      const b = words[index - 2]!;
      const sigma0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const sigma1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_CONSTANTS[index]! + words[index]!) | 0;
      const sum0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    hash = [
      (hash[0]! + a) | 0,
      (hash[1]! + b) | 0,
      (hash[2]! + c) | 0,
      (hash[3]! + d) | 0,
      (hash[4]! + e) | 0,
      (hash[5]! + f) | 0,
      (hash[6]! + g) | 0,
      (hash[7]! + h) | 0,
    ];
  }

  return hash.map((item) => (item >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Provenance - Complete traceability envelope for audit artifacts
 * Every computed value must carry its lineage
 */

export interface Provenance {
  readonly sourceIds: string[];
  readonly engine: 'moon' | 'kosif-v2' | 'ai';
  readonly engineVersion: string;
  readonly inputHash: string;
  readonly generatedAt: Date;
  readonly actorId: string;
  readonly reviewState: 'draft' | 'reviewed' | 'approved';
}

export class ProvenanceEnvelope {
  /**
   * Create a new provenance envelope
   * @throws Error if any required field is missing
   */
  static create(
    sourceIds: string[],
    engine: 'moon' | 'kosif-v2' | 'ai',
    engineVersion: string,
    inputHash: string,
    actorId: string
  ): Provenance {
    if (!sourceIds || sourceIds.length === 0) {
      throw new Error('Provenance requires at least one source ID');
    }
    if (!engine) {
      throw new Error('Provenance requires engine to be specified');
    }
    if (!engineVersion || engineVersion.trim() === '') {
      throw new Error('Provenance requires engine version');
    }
    if (!inputHash || inputHash.trim() === '') {
      throw new Error('Provenance requires input hash');
    }
    if (!actorId || actorId.trim() === '') {
      throw new Error('Provenance requires actor ID');
    }

    return {
      sourceIds,
      engine,
      engineVersion,
      inputHash,
      generatedAt: new Date(),
      actorId,
      reviewState: 'draft',
    };
  }

  /**
   * Create provenance from an existing one (e.g., for review/approval)
   */
  static evolve(
    existing: Provenance,
    reviewState: 'reviewed' | 'approved',
    reviewerActorId: string
  ): Provenance {
    // Keep original source chain
    return {
      ...existing,
      reviewState,
      actorId: reviewerActorId, // Track who reviewed
      generatedAt: new Date(), // Update timestamp
    };
  }

  /**
   * Merge multiple provenances (e.g., combining evidence)
   */
  static merge(provenances: Provenance[]): Provenance {
    if (provenances.length === 0) {
      throw new Error('Cannot merge empty provenance list');
    }

    const mergedSourceIds = Array.from(
      new Set(provenances.flatMap(p => p.sourceIds))
    );

    const engines = new Set(provenances.map(p => p.engine));
    if (engines.size > 1) {
      throw new Error('Cannot merge provenances from different engines');
    }

    const first = provenances[0]!;
    const engine = first.engine;
    const minReviewState = this.minReviewState(
      ...provenances.map(p => p.reviewState)
    );

    return {
      sourceIds: mergedSourceIds,
      engine,
      engineVersion: first.engineVersion,
      inputHash: this.hashInputs(provenances.map(p => p.inputHash).join('|')),
      generatedAt: new Date(),
      actorId: first.actorId,
      reviewState: minReviewState,
    };
  }

  /**
   * Verify provenance integrity
   * @throws Error if provenance is invalid
   */
  static verify(provenance: Provenance): void {
    if (!provenance.sourceIds || provenance.sourceIds.length === 0) {
      throw new Error('Invalid provenance: missing source IDs');
    }

    if (!provenance.engine) {
      throw new Error('Invalid provenance: missing engine');
    }

    if (!provenance.engineVersion) {
      throw new Error('Invalid provenance: missing engine version');
    }

    if (!provenance.inputHash) {
      throw new Error('Invalid provenance: missing input hash');
    }

    if (!provenance.generatedAt || !(provenance.generatedAt instanceof Date)) {
      throw new Error('Invalid provenance: missing or invalid generated date');
    }

    if (!provenance.actorId) {
      throw new Error('Invalid provenance: missing actor ID');
    }

    if (!['draft', 'reviewed', 'approved'].includes(provenance.reviewState)) {
      throw new Error(`Invalid provenance: unknown review state ${provenance.reviewState}`);
    }
  }

  /**
   * Check if provenance is approved and ready for critical decisions
   */
  static isApproved(provenance: Provenance): boolean {
    return provenance.reviewState === 'approved';
  }

  /**
   * Format provenance for logging/display
   */
  static format(provenance: Provenance): string {
    return [
      `Engine: ${provenance.engine}/${provenance.engineVersion}`,
      `Sources: ${provenance.sourceIds.join(', ')}`,
      `InputHash: ${provenance.inputHash.substring(0, 8)}...`,
      `GeneratedAt: ${provenance.generatedAt.toISOString()}`,
      `Actor: ${provenance.actorId}`,
      `State: ${provenance.reviewState}`,
    ].join(' | ');
  }

  /**
   * Simple hash function for combining inputs
   * @private
   */
  private static hashInputs(input: string): string {
    return sha256(input);
  }

  /**
   * Determine minimum review state (most restrictive)
   * @private
   */
  private static minReviewState(
    ...states: Array<'draft' | 'reviewed' | 'approved'>
  ): 'draft' | 'reviewed' | 'approved' {
    if (states.includes('draft')) return 'draft';
    if (states.includes('reviewed')) return 'reviewed';
    return 'approved';
  }
}

/**
 * Provenance builder for fluent API
 */
export class ProvenanceBuilder {
  private sourceIds: string[] = [];
  private engine: 'moon' | 'kosif-v2' | 'ai' | null = null;
  private engineVersion: string | null = null;
  private inputHash: string | null = null;
  private actorId: string | null = null;

  addSource(...ids: string[]): this {
    this.sourceIds.push(...ids);
    return this;
  }

  setEngine(engine: 'moon' | 'kosif-v2' | 'ai', version: string): this {
    this.engine = engine;
    this.engineVersion = version;
    return this;
  }

  setInputHash(hash: string): this {
    this.inputHash = hash;
    return this;
  }

  setActor(actorId: string): this {
    this.actorId = actorId;
    return this;
  }

  build(): Provenance {
    if (!this.engine || !this.engineVersion) {
      throw new Error('Engine and version must be set');
    }
    if (!this.inputHash) {
      throw new Error('Input hash must be set');
    }
    if (!this.actorId) {
      throw new Error('Actor ID must be set');
    }

    return ProvenanceEnvelope.create(
      this.sourceIds,
      this.engine,
      this.engineVersion,
      this.inputHash,
      this.actorId
    );
  }
}
