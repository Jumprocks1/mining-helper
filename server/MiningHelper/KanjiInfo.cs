using System.IO.Compression;
using System.Text;
using System.Text.Json.Serialization;
using System.Xml;
using System.Xml.Serialization;
using MiningHelper.Utils;

namespace MiningHelper;

public static class KanjiInfo
{
    // https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html
    // https://www.edrdg.org/kanjidic/kd2examph.html
    static Dictionary<string, SimplifiedKanjiInfo> KanjiDic { get => field ??= LoadKanjiDic(); }
    [XmlRoot("character")]
    public class CharacterEntry
    {
        [XmlElement("literal")]
        public required string Kanji;
        [XmlElement("radical")]
        public Radical? Radical;

        [XmlIgnore] public int ClassicalRadical => Radical!.Values.Single(x => x.RadType == "classical").Value;

        [XmlElement("reading_meaning")]
        public ReadingMeaning? ReadingMeaning;
        [XmlElement("misc")]
        public required Misc Misc;
    }
    public class Misc
    {
        [XmlElement("stroke_count")]
        public required int Strokes;
    }

    public class ReadingMeaning
    {
        [XmlElement("nanori")]
        public List<string> Nanori = [];
        // The schema claims there can be multiple groups here but I didn't find any
        [XmlElement("rmgroup")]
        public required RmGroup RmGroup;
    }
    public class RmGroup
    {
        [XmlElement("meaning")]
        public List<Meaning> Meanings { get; set; } = [];
        [XmlElement("reading")]
        public List<Reading> Readings { get; set; } = [];
    }
    public class Meaning
    {
        [XmlAttribute("m_lang")]
        public required string Language;
        [XmlText]
        public required string Text;
    }
    public class Reading
    {
        [XmlAttribute("r_type")]
        public required string Type;
        [XmlText]
        public required string Text;
    }

    public class Radical
    {
        [XmlElement("rad_value")]
        public List<RadValue> Values { get; set; } = [];
        public class RadValue
        {
            [XmlAttribute("rad_type")]
            public string? RadType { get; set; }
            [XmlText]
            public int Value { get; set; }
        }
    }
    static Dictionary<string, SimplifiedKanjiInfo> LoadKanjiDic()
    {
        var o = new Dictionary<string, SimplifiedKanjiInfo>();
        {
            using var gz = AppSettings.OpenRead(AppSettings.KanjiDicPath);
            using var decompress = new GZipStream(gz, CompressionMode.Decompress);
            using var reader = XmlReader.Create(decompress, new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Parse,
                IgnoreComments = true,
                IgnoreWhitespace = true
            });
            var serializer = new XmlSerializer(typeof(CharacterEntry));
            while ((reader.NodeType == XmlNodeType.Element && reader.Name == "character") || reader.ReadToFollowing("character"))
            {
                if (serializer.Deserialize(reader) is CharacterEntry el)
                    o[el.Kanji] = new SimplifiedKanjiInfo(el);
            }
        }
        {
            using var gz = AppSettings.OpenRead(AppSettings.KradFilePath);
            using var decompress = new GZipStream(gz, CompressionMode.Decompress);
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            using var streamReader = new StreamReader(decompress, Encoding.GetEncoding("EUC-JP"));
            int getStrokeCount(string part)
            {
                if (o.TryGetValue(part, out var c)) return c.StrokeCount;
                return part switch
                {
                    "｜" => 1,
                    "ノ" => 1,
                    "ヨ" => 3,
                    "ユ" => 2,
                    "ハ" => 2,
                    "マ" => 2,
                    _ => 2 // shouldn't be any of these, but 2 is a good guess
                };
            }
            string? line;
            while ((line = streamReader.ReadLine()) != null)
            {
                if (line.StartsWith('#')) continue;
                var spl = line.Split(':', 2, StringSplitOptions.TrimEntries);
                var kanji = spl[0];
                var parts = new List<KanjiPart>();
                var kanjiInfo = o[kanji];
                foreach (var part in spl[1].Split(' ', StringSplitOptions.TrimEntries))
                {
                    // Contains checks for variants
                    var radical = Radicals.FirstOrDefault(e => e.Kanji.Contains(part));
                    if (part == kanji && radical == null || radical == kanjiInfo.Radical) continue;
                    var meaning = radical?.Meaning;
                    if (meaning == null)
                    {
                        var partInfo = o.GetValueOrDefault(part);
                        if (partInfo != null) meaning = string.Join(", ", partInfo.Meanings);
                    }
                    parts.Add(new() { Part = part, Meaning = meaning });
                }
                kanjiInfo.Parts = [.. parts.OrderBy(e => getStrokeCount(e.Part))];
            }
        }
        return o;
    }
    public static SimplifiedKanjiInfo? Get(string kanji) => KanjiDic.GetValueOrDefault(kanji);

    public static List<RadicalInfo> Radicals => field ??= GetRadicals();
    static List<RadicalInfo> GetRadicals()
    {
        var path = Path.GetFullPath("sources/radicals.csv", AppSettings.SettingsFolder);
        var o = new List<RadicalInfo>();
        var header = true;
        foreach (var line in File.ReadAllLines(path))
        {
            if (header) { header = false; continue; }
            var i = 0;
            var sb = new StringBuilder();
            string readField()
            {
                var quoted = false;
                sb.Clear();
                while (i < line.Length)
                {
                    var c = line[i];
                    i++;
                    if (c == ',' && !quoted) return sb.ToString();
                    if (c == '"' && i < line.Length && line[i] == '"')
                    {
                        sb.Append('"');
                        i += 1;
                    }
                    else if (c == '"') quoted = !quoted;
                    else sb.Append(c);
                }
                return sb.ToString();
            }
            var kanji = readField();
            _ = readField();
            o.Add(new RadicalInfo { Kanji = kanji, Meaning = readField() });
        }
        return o;
    }
}

public class RadicalInfo
{
    public required string Kanji { get; set; } // will also have variants in (...)
    public required string Meaning { get; set; }
}

public class SimplifiedKanjiInfo
{
    public SimplifiedKanjiInfo(KanjiInfo.CharacterEntry Entry)
    {
        Kanji = Entry.Kanji!;
        RadicalIndex = Entry.ClassicalRadical - 1;
        Meanings = Entry.ReadingMeaning?.RmGroup.Meanings.Where(e => e.Language == null).Select(e => e.Text).ToList() ?? [];
        KunReadings = Entry.ReadingMeaning?.RmGroup.Readings.Where(e => e.Type == "ja_kun").Select(e => e.Text).ToList() ?? [];
        OnReadings = Entry.ReadingMeaning?.RmGroup.Readings.Where(e => e.Type == "ja_on").Select(e => e.Text).ToList() ?? [];
        NameReadings = Entry.ReadingMeaning?.Nanori ?? [];
        StrokeCount = Entry.Misc.Strokes;
    }
    public string Kanji { get; set; }
    public List<KanjiPart>? Parts { get; set; }
    public int RadicalIndex;
    public int StrokeCount { get; set; }
    public RadicalInfo Radical => KanjiInfo.Radicals[RadicalIndex];
    public List<string> Meanings { get; set; }
    public List<string> KunReadings { get; set; }
    public List<string> OnReadings { get; set; }
    public List<string> NameReadings { get; set; }
}
public class KanjiPart
{
    public required string Part { get; set; }
    public string? Meaning { get; set; } // some parts like '｜' have no meaning - jisho works this way too
}