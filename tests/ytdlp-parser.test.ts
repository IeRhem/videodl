import { describe, expect, it } from 'vitest';
import {
  parseDestinationLine,
  parseMetadataJson,
  parseProgressLine,
} from '../src/infrastructure/ytdlp/ytdlp-parser.js';

describe('ytdlp-parser', () => {
  it('parses structured progress lines', () => {
    const line = '__VDL__| 42.5%|1048576|2097152|524288.0|12';
    const progress = parseProgressLine(line);
    expect(progress).toEqual({
      percent: 42.5,
      downloadedBytes: 1048576,
      totalBytes: 2097152,
      speedBytesPerSec: 524288,
      etaSeconds: 12,
    });
  });

  it('handles NA values in progress lines gracefully', () => {
    const line = '__VDL__|  0.0%|NA|Unknown|NA|NA';
    const progress = parseProgressLine(line);
    expect(progress).toEqual({
      percent: 0,
      downloadedBytes: null,
      totalBytes: null,
      speedBytesPerSec: null,
      etaSeconds: null,
    });
    expect(parseProgressLine('unrelated stdout line')).toBeNull();
  });

  it('computes percent fallback from downloaded/total bytes when _percent_str is NA', () => {
    const line = '__VDL__|NA|500|1000|250|2';
    const progress = parseProgressLine(line);
    expect(progress?.percent).toBe(50);
    expect(progress?.speedBytesPerSec).toBe(250);
    expect(progress?.etaSeconds).toBe(2);
  });

  it('parses destination filepath lines', () => {
    expect(parseDestinationLine('__VDL_FILE__|/home/user/Videos/clip.mkv')).toBe(
      '/home/user/Videos/clip.mkv',
    );
    expect(parseDestinationLine('[download] 100%')).toBeNull();
  });

  it('parses single video and playlist JSON metadata', () => {
    const single = parseMetadataJson(
      JSON.stringify({
        id: 'vid123',
        title: 'Test Video',
        extractor_key: 'Youtube',
        duration: 125,
        uploader: 'Author',
        webpage_url: 'https://youtube.com/watch?v=vid123',
      }),
      'https://youtube.com/watch?v=vid123',
    );
    expect(single.isPlaylist).toBe(false);
    expect(single.title).toBe('Test Video');
    expect(single.durationSeconds).toBe(125);

    const playlist = parseMetadataJson(
      JSON.stringify({
        _type: 'playlist',
        id: 'pl1',
        title: 'My Playlist',
        extractor_key: 'YoutubeTab',
        entries: [
          { id: '1', url: 'https://youtube.com/watch?v=1', title: 'One', duration: 60 },
          { id: '2', url: 'https://youtube.com/watch?v=2', title: 'Two', duration: 90 },
          null,
        ],
      }),
      'https://youtube.com/playlist?list=pl1',
    );
    expect(playlist.isPlaylist).toBe(true);
    expect(playlist.playlistTitle).toBe('My Playlist');
    expect(playlist.playlistCount).toBe(2);
    expect(playlist.entries).toHaveLength(2);
  });
});
